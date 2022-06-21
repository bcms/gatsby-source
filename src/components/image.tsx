import type { BCMSMediaParsed } from '@becomes/cms-client/types';
import type { BCMSMostImageProcessorProcessOptions } from '@becomes/cms-most/types';
import { createBcmsImageHandler } from '@becomes/cms-most/frontend';
import * as React from 'react';
import { output } from '@becomes/cms-most/frontend/_output-path';

interface Props {
  media: BCMSMediaParsed;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  options?: BCMSMostImageProcessorProcessOptions;
  svg?: boolean;
}

const BCMSImage: React.FC<Props> = ({
  media,
  options,
  className,
  id,
  style,
  svg,
}) => {
  const handler = createBcmsImageHandler(media, options);
  const [srcSet, setSrcSet] = React.useState(handler.getSrcSet());
  const container = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    window.removeEventListener('resize', resizeHandler);
    const el = container.current;
    if (!el) {
      return;
    }
    function resizeHandler() {
      if (el) {
        setSrcSet(
          handler.getSrcSet({
            width: el.offsetWidth,
          }),
        );
      }
    }
    resizeHandler();
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, [media, options]);

  return (
    <div
      id={id}
      className={`bcmsImage ${className || ''}`}
      style={style}
      ref={container}
      data-bcms-img-w={srcSet[2]}
      data-bcms-img-h={srcSet[3]}
      data-bcms-img-src={media.src}
      data-bcms-img-ops={handler.optionString}
      data-bcms-img-idx={srcSet[4]}
    >
      <>
        {handler.parsable ? (
          <picture>
            <source srcSet={srcSet[0]} />
            <source srcSet={srcSet[1]} />
            <img
              data-bcms-image={handler.optionString + ';' + media.src}
              src={output + media.src}
              alt={media.alt_text}
              width={srcSet[2]}
              height={srcSet[3]}
            />
          </picture>
        ) : svg && media.svg ? (
          <div dangerouslySetInnerHTML={{ __html: media.svg }} />
        ) : (
          <img
            src={srcSet[1]}
            alt={media.alt_text}
            width={media.width}
            height={media.height}
          />
        )}
      </>
    </div>
  );
};

export default BCMSImage;
