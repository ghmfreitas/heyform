import { FieldKindEnum } from '@heyform-inc/shared-types-enums'
import * as assert from 'assert'

import { isAllowedUploadField } from '../src/utils/upload'

function testAllowsOnlyUploadAndSignatureFields() {
  const form = {
    fields: [
      {
        id: 'text_1',
        kind: FieldKindEnum.SHORT_TEXT
      },
      {
        id: 'file_1',
        kind: FieldKindEnum.FILE_UPLOAD
      },
      {
        id: 'group_1',
        kind: FieldKindEnum.GROUP,
        properties: {
          fields: [
            {
              id: 'signature_1',
              kind: FieldKindEnum.SIGNATURE
            }
          ]
        }
      }
    ]
  }

  assert.strictEqual(isAllowedUploadField(form, 'file_1'), true)
  assert.strictEqual(isAllowedUploadField(form, 'signature_1'), true)
  assert.strictEqual(isAllowedUploadField(form, 'text_1'), false)
  assert.strictEqual(isAllowedUploadField(form, 'missing'), false)
}

function run() {
  testAllowsOnlyUploadAndSignatureFields()
}

if (require.main === module) {
  try {
    run()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  }
}
