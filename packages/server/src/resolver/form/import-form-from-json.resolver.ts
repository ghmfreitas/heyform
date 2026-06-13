import {
  CaptchaKindEnum,
  FieldKindEnum,
  FormKindEnum,
  FormSettings,
  FormStatusEnum,
  InteractiveModeEnum
} from '@heyform-inc/shared-types-enums'
import { BadRequestException } from '@nestjs/common'

import { Auth, ProjectGuard, Team, User } from '@decorator'
import { ImportFormFromJSONInput } from '@graphql'
import { nanoid } from '@heyform-inc/utils'
import { TeamModel, UserModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { FormService } from '@service'
import { sanitizeFormDrafts } from '@utils'

const DEFAULT_FORM_NAME = 'Imported form'
const MAX_FORM_JSON_LENGTH = 1_000_000
const MAX_FIELD_COUNT = 100

type ImportFormSettings = FormSettings & {
  enableEmailNotification?: boolean
}

const DEFAULT_SETTINGS: ImportFormSettings = {
  active: false,
  captchaKind: CaptchaKindEnum.NONE,
  filterSpam: false,
  allowArchive: true,
  requirePassword: false,
  locale: 'en',
  enableQuestionList: true,
  enableNavigationArrows: true,
  enableEmailNotification: true
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseFormJson(formJson: string): Record<string, any> | any[] {
  if (typeof formJson !== 'string' || formJson.length < 1) {
    throw new BadRequestException('Invalid JSON format')
  }

  if (formJson.length > MAX_FORM_JSON_LENGTH) {
    throw new BadRequestException('The JSON file is too large')
  }

  try {
    return JSON.parse(formJson.replace(/^\uFEFF/, '').trim())
  } catch {
    throw new BadRequestException('Invalid JSON format')
  }
}

function enumNumberValue<T>(
  enumObject: Record<string, string | number>,
  value: unknown,
  fallback: T
): T {
  const allowedValues = Object.values(enumObject).filter(row => typeof row === 'number')
  const normalized = typeof value === 'string' ? Number(value) : value

  if (typeof normalized === 'number' && allowedValues.includes(normalized)) {
    return normalized as T
  }

  return fallback
}

function normalizeSettings(settings: unknown): ImportFormSettings {
  if (!isObject(settings)) {
    return DEFAULT_SETTINGS
  }

  return {
    ...DEFAULT_SETTINGS,
    locale: typeof settings.locale === 'string' && settings.locale.trim() ? settings.locale : 'en',
    enableQuestionList:
      typeof settings.enableQuestionList === 'boolean'
        ? settings.enableQuestionList
        : DEFAULT_SETTINGS.enableQuestionList,
    enableNavigationArrows:
      typeof settings.enableNavigationArrows === 'boolean'
        ? settings.enableNavigationArrows
        : DEFAULT_SETTINGS.enableNavigationArrows,
    enableEmailNotification:
      typeof settings.enableEmailNotification === 'boolean'
        ? settings.enableEmailNotification
        : DEFAULT_SETTINGS.enableEmailNotification
  }
}

function normalizeField(field: unknown, state: { count: number }): Record<string, any> {
  if (!isObject(field)) {
    throw new BadRequestException('Every form field must be a JSON object')
  }

  state.count += 1

  if (state.count > MAX_FIELD_COUNT) {
    throw new BadRequestException(`A form can import up to ${MAX_FIELD_COUNT} fields`)
  }

  if (!Object.values(FieldKindEnum).includes(field.kind)) {
    throw new BadRequestException(`Invalid field kind: ${String(field.kind || '')}`)
  }

  const normalized = {
    ...field,
    id: typeof field.id === 'string' && field.id.trim() ? field.id : nanoid(12),
    kind: field.kind,
    validations: isObject(field.validations) ? field.validations : {},
    properties: isObject(field.properties) ? field.properties : {},
    layout: isObject(field.layout) ? field.layout : null
  }

  if (Array.isArray(normalized.properties.fields)) {
    normalized.properties = {
      ...normalized.properties,
      fields: normalized.properties.fields.map(child => normalizeField(child, state))
    }
  }

  return normalized
}

function normalizeFields(payload: Record<string, any> | any[]): Record<string, any>[] {
  const fields = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.fields)
      ? payload.fields
      : payload.drafts

  if (!Array.isArray(fields) || fields.length < 1) {
    throw new BadRequestException('The JSON file must contain a non-empty fields array')
  }

  const state = {
    count: 0
  }

  return sanitizeFormDrafts(fields.map(field => normalizeField(field, state)))
}

@Resolver()
@Auth()
export class ImportFormFromJSONResolver {
  constructor(private readonly formService: FormService) {}

  @Mutation(returns => String)
  @ProjectGuard()
  async importFormFromJSON(
    @Team() team: TeamModel,
    @User() user: UserModel,
    @Args('input') input: ImportFormFromJSONInput
  ): Promise<string> {
    const payload = parseFormJson(input.formJson)
    const source = Array.isArray(payload) ? {} : payload
    const fields = normalizeFields(payload)
    const name =
      typeof source.name === 'string' && source.name.trim() ? source.name.trim() : DEFAULT_FORM_NAME

    return this.formService.create({
      teamId: team.id,
      projectId: input.projectId,
      memberId: user.id,
      name,
      fields: [],
      _drafts: JSON.stringify(fields),
      fieldsUpdatedAt: 0,
      settings: normalizeSettings(source.settings),
      hiddenFields: Array.isArray(source.hiddenFields) ? source.hiddenFields : [],
      variables: Array.isArray(source.variables) ? source.variables : [],
      logics: Array.isArray(source.logics) ? source.logics : [],
      translations: isObject(source.translations) ? source.translations : {},
      themeSettings: isObject(source.themeSettings) ? source.themeSettings : undefined,
      version: 0,
      kind: enumNumberValue<FormKindEnum>(FormKindEnum, source.kind, FormKindEnum.SURVEY),
      interactiveMode: enumNumberValue<InteractiveModeEnum>(
        InteractiveModeEnum,
        source.interactiveMode,
        InteractiveModeEnum.GENERAL
      ),
      status: FormStatusEnum.NORMAL
    })
  }
}
