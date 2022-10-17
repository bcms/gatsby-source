import type {
  BCMSEntryContentParsedItem,
  BCMSPropRichTextDataParsed,
} from '@becomes/cms-client/types';
import * as React from 'react';
import BCMSContentItem from './content-item';

export interface BCMSWidgetComponents {
  [bcmsWidgetName: string]: React.FC<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
  }>;
}

interface Props {
  id?: string;
  style?: React.CSSProperties;
  className?: string;
  items: BCMSPropRichTextDataParsed;
  widgetComponents: BCMSWidgetComponents;
  nodeParser?(item: BCMSEntryContentParsedItem): string;
}

const BCMSContentManager: React.FC<Props> = (props) => {
  return (
    <div
      id={props.id}
      style={props.style}
      className={`content ${props.className || ''}`}
    >
      {props.items.map((_item, _itemIdx) => {
        return (
          <>
            {_item instanceof Array ? (
              <>
                {_item.map((item, itemIdx) => {
                  return (
                    <BCMSContentItem
                      key={`${_itemIdx}_${itemIdx}`}
                      item={item}
                      components={props.widgetComponents}
                      nodeParser={props.nodeParser}
                    />
                  );
                })}
              </>
            ) : (
              <BCMSContentItem
                key={_itemIdx}
                item={_item}
                components={props.widgetComponents}
                nodeParser={props.nodeParser}
              />
            )}
          </>
        );
      })}
    </div>
  );
};

export default BCMSContentManager;
