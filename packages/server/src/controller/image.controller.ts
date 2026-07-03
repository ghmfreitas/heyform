import { Controller, Get, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { createReadStream, promises } from 'fs'
import got from 'got'
import type { Response as GotResponse } from 'got'
import { resolve } from 'path'
import * as sharp from 'sharp'
import { Readable } from 'stream'

import { ALLOWED_IMAGE_HOSTS, FIRST_PARTY_IMAGE_ORIGINS, ImageResizingDto } from '@dto'
import { UPLOAD_DIR } from '@environments'
import { qs } from '@heyform-inc/utils'
import { Logger, assertSafeOutboundRequest, md5 } from '@utils'

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

@Controller()
export class ImageController {
  private readonly logger = new Logger(ImageController.name)

  @Get('/api/image')
  async index(@Query() input: ImageResizingDto, @Res() res: Response) {
    const filePath = await this._getPath(input)
    const headersPath = `${filePath}.json`
    const isFileExists = await this._isFileExists(filePath)

    if (isFileExists) {
      const headers = JSON.parse((await promises.readFile(headersPath)).toString())

      res.set(headers)
      return createReadStream(filePath).pipe(res)
    }

    const { lookup, url } = await assertSafeOutboundRequest(input.url, {
      allowedHosts: ALLOWED_IMAGE_HOSTS,
      allowedPrivateOrigins: FIRST_PARTY_IMAGE_ORIGINS
    })

    let result: GotResponse<Buffer>

    try {
      result = await got(url.toString(), {
        followRedirect: false,
        lookup,
        responseType: 'buffer',
        retry: {
          limit: 0
        },
        timeout: {
          request: 10_000
        }
      })
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to fetch image from "${input.url}": ${getErrorMessage(error, 'Unknown got error')}`
      )

      return this._sendEmptyImageResponse(res)
    }

    const contentTypeHeader = result.headers['content-type']
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader

    if (!contentType?.toLowerCase().startsWith('image/')) {
      this.logger.warn(
        `Image URL "${input.url}" returned unsupported content type "${contentType}"`
      )

      return this._sendEmptyImageResponse(res)
    }

    let fileBuffer = result.body
    const width = input.w ? Number(input.w) : undefined
    const height = input.h ? Number(input.h) : undefined

    if (width > 0 || height > 0) {
      try {
        fileBuffer = await sharp(result.body).resize({ width, height }).toBuffer()
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to resize image from "${input.url}", serving original response instead: ${getErrorMessage(
            error,
            'Unknown sharp error'
          )}`
        )
      }
    }

    const headers = {
      'Content-Type': result.headers['content-type'],
      'Content-Length': fileBuffer.length,
      'Cache-Control': 'public, max-age=315360000, must-revalidate'
    }

    await Promise.all([
      promises.writeFile(headersPath, JSON.stringify(headers), {
        encoding: 'utf8'
      }),
      promises.writeFile(filePath, fileBuffer)
    ])

    res.set(headers)
    this._getReadableStream(fileBuffer).pipe(res)
  }

  private async _isFileExists(filePath: string) {
    try {
      const result = await promises.stat(filePath)
      return result.isFile()
    } catch {
      return false
    }
  }

  private async _getPath(input: ImageResizingDto) {
    const hash = md5(qs.stringify(input))
    const dir = resolve(UPLOAD_DIR, hash.slice(0, 2), hash.slice(2, 4))

    await promises.mkdir(dir, {
      recursive: true
    })

    return resolve(dir, hash.slice(4))
  }

  private _getReadableStream(buffer: Buffer): Readable {
    const stream = new Readable()

    stream.push(buffer)
    stream.push(null)

    return stream
  }

  private _sendEmptyImageResponse(res: Response) {
    res.status(204)
    res.set({
      'Cache-Control': 'no-store'
    })

    return res.end()
  }
}
