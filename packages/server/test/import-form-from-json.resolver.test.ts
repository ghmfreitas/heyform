import * as assert from 'assert'

import { ImportFormFromJSONResolver } from '../src/resolver/form/import-form-from-json.resolver'

async function testImportsJsonAsInactiveDraft() {
  const createdForms: any[] = []
  const resolver = new ImportFormFromJSONResolver({
    create: async (form: any) => {
      createdForms.push(form)
      return 'form_123'
    }
  } as any)

  const result = await resolver.importFormFromJSON(
    { id: 'team_1' } as any,
    { id: 'user_1' } as any,
    {
      projectId: 'project_1',
      formJson: JSON.stringify({
        name: 'Imported lead form',
        kind: 2,
        interactiveMode: 2,
        settings: {
          active: true,
          locale: 'pt-br',
          enableQuestionList: false
        },
        fields: [
          {
            id: 'field_1',
            kind: 'short_text',
            title: '<p>Nome</p>',
            validations: {
              required: true
            }
          }
        ]
      })
    }
  )

  assert.strictEqual(result, 'form_123')
  assert.strictEqual(createdForms[0].teamId, 'team_1')
  assert.strictEqual(createdForms[0].projectId, 'project_1')
  assert.strictEqual(createdForms[0].memberId, 'user_1')
  assert.strictEqual(createdForms[0].name, 'Imported lead form')
  assert.strictEqual(createdForms[0].kind, 2)
  assert.strictEqual(createdForms[0].interactiveMode, 2)
  assert.strictEqual(createdForms[0].settings.active, false)
  assert.strictEqual(createdForms[0].settings.locale, 'pt-br')
  assert.strictEqual(createdForms[0].settings.enableQuestionList, false)
  assert.deepStrictEqual(JSON.parse(createdForms[0]._drafts)[0].title, [['p', ['Nome']]])
}

async function testRejectsJsonWithoutFields() {
  const resolver = new ImportFormFromJSONResolver({
    create: async () => {
      throw new Error('create should not be called')
    }
  } as any)

  await assert.rejects(
    () =>
      resolver.importFormFromJSON({ id: 'team_1' } as any, { id: 'user_1' } as any, {
        projectId: 'project_1',
        formJson: JSON.stringify({
          name: 'Empty import'
        })
      }),
    /fields array/
  )
}

async function run() {
  await testImportsJsonAsInactiveDraft()
  await testRejectsJsonWithoutFields()
}

if (require.main === module) {
  run().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  })
}
