import {
  CaptchaKindEnum,
  FormKindEnum,
  FormStatusEnum,
  InteractiveModeEnum
} from '@heyform-inc/shared-types-enums'
import { BadRequestException, InternalServerErrorException, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'

import {
  createFieldsPrompt,
  createFormPrompt,
  createLogicsPrompt,
  createThemePrompt
} from '@config'
import { Auth, Form, FormGuard, ProjectGuard, Team, User } from '@decorator'
import { OPENAI_API_KEY } from '@environments'
import {
  CreateFieldsWithAIInput,
  CreateFormThemeWithAIInput,
  CreateFormWithAIInput
} from '@graphql'
import { GqlThrottlerGuard } from '@guard'
import { helper, hs, parseJson } from '@heyform-inc/utils'
import { FormModel, TeamModel, UserModel } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { FormService, OpenAIService } from '@service'
import { Logger, parseAIJson } from '@utils'
import { GraphQLJSONObject } from 'graphql-type-json'

interface AIFormResult {
  name?: string
  fields?: unknown[]
}

interface TeamPlan {
  aiForm?: boolean
  themeCustomization?: boolean
}

type TeamWithPlan = TeamModel & {
  plan?: TeamPlan
}

@Resolver()
@Auth()
export class AIResolver {
  private readonly logger = new Logger(AIResolver.name)

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly formService: FormService
  ) {}

  @Mutation(returns => String)
  @ProjectGuard()
  @UseGuards(GqlThrottlerGuard)
  @Throttle({
    default: {
      limit: 10,
      ttl: hs('1h')
    }
  })
  async createFormWithAI(
    @Team() team: TeamModel,
    @User() user: UserModel,
    @Args('input') input: CreateFormWithAIInput
  ): Promise<string> {
    if (!this.getPlan(team).aiForm) {
      throw new BadRequestException('Upgrade your plan to create form with AI')
    }

    const json = await this.createAIJson<AIFormResult>(
      createFormPrompt(input.topic, input.reference),
      'Failed to generate question object'
    )

    if (!helper.isObject(json) || !helper.isValidArray(json.fields)) {
      throw new InternalServerErrorException('Failed to generate question object')
    }

    return this.formService.create({
      teamId: team.id,
      projectId: input.projectId,
      memberId: user.id,
      name: helper.isValid(json.name?.trim()) ? json.name.trim() : input.topic,
      fields: [],
      _drafts: JSON.stringify(json.fields),
      fieldsUpdatedAt: 0,
      settings: {
        active: false,
        captchaKind: CaptchaKindEnum.NONE,
        filterSpam: false,
        allowArchive: true,
        requirePassword: false,
        locale: 'en',
        enableQuestionList: true,
        enableNavigationArrows: true,
        enableEmailNotification: true
      },
      hiddenFields: [],
      version: 0,
      kind: FormKindEnum.SURVEY,
      interactiveMode: InteractiveModeEnum.GENERAL,
      status: FormStatusEnum.NORMAL
    })
  }

  @Mutation(returns => [GraphQLJSONObject])
  @FormGuard()
  async createFieldsWithAI(
    @Team() team: TeamModel,
    @Form() form: FormModel,
    @Args('input') input: CreateFieldsWithAIInput
  ): Promise<Record<string, unknown>[]> {
    if (!this.getPlan(team).aiForm) {
      throw new BadRequestException('Upgrade your plan to edit form with AI')
    }

    const fields = await this.createAIJson<Record<string, unknown>[]>(
      createFieldsPrompt(form.name, parseJson(form._drafts), input.prompt),
      'Failed to create fields'
    )

    if (!helper.isValidArray(fields)) {
      throw new InternalServerErrorException('Failed to create fields')
    }

    return fields
  }

  @Mutation(returns => [GraphQLJSONObject])
  @FormGuard()
  async createFormLogicsWithAI(
    @Team() team: TeamModel,
    @Form() form: FormModel,
    @Args('input') input: CreateFieldsWithAIInput
  ): Promise<Record<string, unknown>[]> {
    if (!this.getPlan(team).aiForm) {
      throw new BadRequestException('Upgrade your plan to setup logics with AI')
    }

    const logics = await this.createAIJson<Record<string, unknown>[]>(
      createLogicsPrompt(parseJson(form._drafts), form.logics, input.prompt),
      'Failed to generate logics'
    )

    if (!helper.isValidArray(logics)) {
      throw new InternalServerErrorException('Failed to generate logics')
    }

    return logics
  }

  @Mutation(returns => GraphQLJSONObject)
  @FormGuard()
  async createFormThemeWithAI(
    @Team() team: TeamModel,
    @Args('input') input: CreateFormThemeWithAIInput
  ): Promise<Record<string, unknown>> {
    const plan = this.getPlan(team)

    if (!plan.themeCustomization) {
      throw new BadRequestException('Upgrade your plan to setup theme customization')
    }

    if (!plan.aiForm) {
      throw new BadRequestException('Upgrade your plan to setup theme with AI')
    }

    const theme = await this.createAIJson<Record<string, unknown>>(
      createThemePrompt(input.theme, input.prompt),
      'Failed to create theme'
    )

    if (!helper.isObject(theme)) {
      throw new InternalServerErrorException('Failed to create theme')
    }

    return theme
  }

  private getPlan(team: TeamModel): TeamPlan {
    const plan = (team as TeamWithPlan).plan || {}

    if (helper.isValid(OPENAI_API_KEY)) {
      return {
        ...plan,
        aiForm: true,
        themeCustomization: true
      }
    }

    return plan
  }

  private async createAIJson<T>(prompt: string, errorMessage: string): Promise<T> {
    const result = await this.openAIService.chatCompletion({
      response_format: {
        type: 'json_object'
      },
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
    const content = result.choices[0]?.message?.content

    this.logger.info(content)

    if (helper.isEmpty(content)) {
      throw new InternalServerErrorException(errorMessage)
    }

    try {
      return parseAIJson<T>(content)
    } catch (error) {
      this.logger.error(error)
      throw new InternalServerErrorException(errorMessage)
    }
  }
}
