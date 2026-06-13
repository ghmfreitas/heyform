import * as assert from 'assert'

process.env.OPENAI_API_KEY = 'test-openai-key'

const { AIResolver } = require('../src/resolver/form/ai.resolver')

function testEnablesAIForSelfHostedInstall() {
  const resolver = new AIResolver({} as any, {} as any)
  const plan = (resolver as any).getPlan({} as any)

  assert.strictEqual(plan.aiForm, true)
  assert.strictEqual(plan.themeCustomization, true)
}

function run() {
  testEnablesAIForSelfHostedInstall()
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
