import got from 'got'

import { assertSafeOutboundRequest } from '@utils'

export default {
  id: 'webhook',
  name: 'Webhook',
  description:
    "With webhooks integration, you can send every submission straight to any URL as soon as it's submitted.",
  icon: '/static/webhook.png',
  settings: [
    {
      type: 'url',
      name: 'endpointUrl',
      label: 'Endpoint URL',
      placeholder: 'https://webhook.example.com',
      required: true
    }
  ],
  run: async ({ config, submission, form }) => {
    const { lookup, url: endpointUrl } = await assertSafeOutboundRequest(config.endpointUrl)

    return got
      .post(endpointUrl.toString(), {
        followRedirect: false,
        lookup,
        json: {
          id: submission.id,
          formId: form.id,
          formName: form.name,
          fields: form.fields,
          answers: submission.answers,
          hiddenFields: submission.hiddenFields,
          variables: submission.variables
        }
      })
      .text()
  }
}
