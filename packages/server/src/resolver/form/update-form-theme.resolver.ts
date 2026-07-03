import { BadRequestException } from '@nestjs/common'

import { Auth, FormGuard } from '@decorator'
import { UpdateFormThemeInput } from '@graphql'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { FormService } from '@service'
import { isSafeCustomCSS } from '@utils'

@Resolver()
@Auth()
export class UpdateFormThemeResolver {
  constructor(private readonly formService: FormService) {}

  @Mutation(returns => Boolean)
  @FormGuard()
  async updateFormTheme(@Args('input') input: UpdateFormThemeInput): Promise<boolean> {
    if (!isSafeCustomCSS(input.theme?.customCSS)) {
      throw new BadRequestException('Custom CSS contains unsafe HTML characters')
    }

    return await this.formService.update(input.formId, {
      themeSettings: {
        logo: input.logo,
        theme: input.theme
      }
    })
  }
}
