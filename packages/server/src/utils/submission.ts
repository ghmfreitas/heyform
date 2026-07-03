import { HiddenField, HiddenFieldAnswer } from '@heyform-inc/shared-types-enums'

export function normalizeSubmissionHiddenFields(
  definitions: HiddenField[] = [],
  submitted: HiddenFieldAnswer[] = []
): HiddenFieldAnswer[] {
  const used = new Set<string>()

  return definitions
    .map(definition => {
      if (used.has(definition.id)) {
        return
      }

      const answer = submitted.find(
        row => row?.id === definition.id || row?.name === definition.name
      )

      if (!answer) {
        return
      }

      used.add(definition.id)

      return {
        id: definition.id,
        name: definition.name,
        value: answer.value === undefined || answer.value === null ? '' : String(answer.value)
      }
    })
    .filter(Boolean) as HiddenFieldAnswer[]
}
