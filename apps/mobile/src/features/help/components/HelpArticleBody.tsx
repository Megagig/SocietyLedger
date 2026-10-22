import { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { parseArticleContent, type ArticleBlock } from '../parseArticle';

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Text variant={block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3'} className="mt-2">
          {block.text}
        </Text>
      );
    case 'bullets':
      return (
        <View className="gap-1.5">
          {block.items.map((item, index) => (
            <View key={index} className="flex-row gap-2 pl-1">
              <Text variant="body" tone="secondary">
                •
              </Text>
              <Text variant="body" className="flex-1">
                {item}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'numbered':
      return (
        <Text variant="body" className="pl-1">
          {block.text}
        </Text>
      );
    default:
      return <Text variant="body">{block.text}</Text>;
  }
}

/** An article's body, rendered from its light text formatting. */
export function HelpArticleBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseArticleContent(content), [content]);
  return (
    <View className="gap-3" testID="help-article-body">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </View>
  );
}
