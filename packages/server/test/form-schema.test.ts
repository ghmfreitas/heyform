import * as assert from 'assert'

import { isSafeCustomCSS, sanitizeFormDrafts } from '../src/utils/form-schema'

function testSanitizesDraftRichText() {
  const drafts = sanitizeFormDrafts([
    {
      id: 'field_1',
      kind: 'short_text',
      title: '<p>Hello<img src=x onerror=alert(1)></p>',
      titleSchema: '<svg onload=alert(1)>bad</svg>',
      description: [
        [
          'a',
          ['<img src=x onerror=alert(1)>'],
          {
            href: '" onmouseover="alert(1)',
            style: 'background: url(javascript:alert(1))'
          }
        ]
      ],
      properties: {
        fields: [
          {
            id: 'child_1',
            kind: 'short_text',
            title: '<span onclick="alert(1)">Child</span>',
            description: '<script>alert(1)</script>'
          }
        ]
      }
    }
  ])

  assert.deepStrictEqual(drafts[0].title, [['p', ['Hello']]])
  assert.deepStrictEqual(drafts[0].titleSchema, [])
  assert.deepStrictEqual(drafts[0].description, [
    [
      'a',
      ['&lt;img src=x onerror=alert(1)&gt;'],
      {
        href: '&quot; onmouseover=&quot;alert(1)'
      }
    ]
  ])
  assert.deepStrictEqual(drafts[0].properties.fields[0].title, [['span', ['Child']]])
  assert.deepStrictEqual(drafts[0].properties.fields[0].description, [])
}

function testSanitizesNestedGroupDrafts() {
  const drafts = sanitizeFormDrafts([
    {
      id: 'group_1',
      kind: 'group',
      title: 'Parent',
      properties: {
        fields: [
          {
            id: 'group_2',
            kind: 'group',
            title: '<p>Child group</p>',
            properties: {
              fields: [
                {
                  id: 'child_1',
                  kind: 'short_text',
                  title: '<img src=x onerror=alert(1)>Nested child'
                }
              ]
            }
          }
        ]
      }
    }
  ])

  assert.deepStrictEqual(drafts[0].properties.fields[0].title, [['p', ['Child group']]])
  assert.deepStrictEqual(drafts[0].properties.fields[0].properties.fields[0].title, [
    'Nested child'
  ])
}

function testDropsUnsafeHrefProtocols() {
  const drafts = sanitizeFormDrafts([
    {
      id: 'field_1',
      kind: 'short_text',
      title: [
        [
          'a',
          ['click me'],
          {
            href: 'javascript:alert(1)'
          }
        ]
      ]
    }
  ])

  assert.deepStrictEqual(drafts[0].title, [['a', ['click me']]])
}

function testDropsControlCharacterSplitUnsafeHrefProtocols() {
  const drafts = sanitizeFormDrafts([
    {
      id: 'field_1',
      kind: 'short_text',
      title: [
        [
          'a',
          ['click me'],
          {
            href: 'java\tscript:alert(1)'
          }
        ]
      ]
    }
  ])

  assert.deepStrictEqual(drafts[0].title, [['a', ['click me']]])
}

function testCustomCssRejectsHtmlBreakingCharacters() {
  assert.strictEqual(isSafeCustomCSS('body { color: red; }'), true)
  assert.strictEqual(
    isSafeCustomCSS('body { color: red; }</style><script>alert(1)</script>'),
    false
  )
  assert.strictEqual(isSafeCustomCSS('body:before { content: "<"; }'), false)
}

function run() {
  testSanitizesDraftRichText()
  testSanitizesNestedGroupDrafts()
  testDropsUnsafeHrefProtocols()
  testDropsControlCharacterSplitUnsafeHrefProtocols()
  testCustomCssRejectsHtmlBreakingCharacters()
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
