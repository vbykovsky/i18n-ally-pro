import { CompletionItemProvider, TextDocument, Position, CompletionItem, CompletionItemKind, languages } from 'vscode'
import { ExtensionModule } from '~/modules'
import { ejectNamespaceFromKey } from '~/utils'
import { Global, KeyDetector, Loader, CurrentFile, LocaleTree, LocaleNode } from '~/core'

class CompletionProvider implements CompletionItemProvider {
  public provideCompletionItems(
    document: TextDocument,
    position: Position,
  ) {
    if (!Global.enabled)
      return

    const loader: Loader = CurrentFile.loader
    const key = KeyDetector.getKey(document, position, true)

    const scopes = Global.enabledFrameworks.flatMap(f => f.getScopeRange(document) || [])
    const namespaces = scopes?.map(scope => scope.namespace) || []
    const hasMultipleNamespaces = namespaces && namespaces.length > 1

    if (key === undefined)
      return

    if (!key) {
      return Object
        .values(CurrentFile.loader.keys)
        .filter(key => namespaces.includes(key.split(Global.getNamespaceDelimiter())[0]))
        .map((key) => {
          const { namespacelessKey } = ejectNamespaceFromKey(namespaces, key, Global.getNamespaceDelimiter())

          return ({
            key,
            namespacelessKey: hasMultipleNamespaces ? key : namespacelessKey,
          })
        })
        .map(({ key, namespacelessKey }) => {
          const item = new CompletionItem(namespacelessKey, CompletionItemKind.Text)
          item.detail = loader.getValueByKey(key)

          return item
        })
    }

    let parent = ''

    const parts = key.split(/[.:]/g)

    if (parts.length > 1)
      parent = parts.slice(0, -1).join('.')

    let node: LocaleTree | LocaleNode | undefined

    if (!key)
      node = loader.root

    if (!node)
      node = loader.getTreeNodeByKey(key)

    if (!node && parent)
      node = loader.getTreeNodeByKey(parent)

    if (!node || node.type !== 'tree')
      return

    return Object
      .values(node.children)
      .map((child) => {
        const item = new CompletionItem(
          child.keyname,
          child.type === 'tree'
            ? CompletionItemKind.Field
            : CompletionItemKind.Text,
        )
        item.commitCharacters = ['.', ':']
        item.detail = child.type === 'node' ? child.getValue() : undefined
        return item
      })
  }
}

const m: ExtensionModule = () => {
  return languages.registerCompletionItemProvider(
    Global.getDocumentSelectors(),
    new CompletionProvider(),
    '.', '\'', '"', '`', ':',
  )
}

export default m
