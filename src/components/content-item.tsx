import {
  BCMSEntryContentNodeType,
  BCMSEntryContentParsedItem,
} from '@becomes/cms-client/types';
import * as React from 'react';
import type { BCMSWidgetComponents } from './content-manager';

interface Props {
  item: BCMSEntryContentParsedItem;
  components: BCMSWidgetComponents;
  nodeParser?(item: BCMSEntryContentParsedItem): string;
}

const BCMSContentItem: React.FC<Props> = ({ item, components, nodeParser }) => {
  if (item.name && item.type === BCMSEntryContentNodeType.widget) {
    if (components[item.name]) {
      const Widget = components[item.name];
      return <Widget data={item.value} />;
    } else {
      return (
        <div style={{ display: 'none' }} data-error>
          Widget {item.name} is not handled
        </div>
      );
    }
  }

  return (
    <div
      className={`content-primitive content--${item.type}`}
      dangerouslySetInnerHTML={{
        __html: nodeParser ? nodeParser(item) : (item.value as string),
      }}
    />
  );
};

export default BCMSContentItem;
