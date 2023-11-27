/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import type { BCMSEntryParsed } from '@becomes/cms-client/types';
import type {
  BCMSMediaExtended,
  BCMSMostConfig,
} from '@becomes/cms-most/types';
import type {
  CreateResolversArgs,
  CreateSchemaCustomizationArgs,
  GatsbyNode,
} from 'gatsby';
import { getBcmsMost, __createBcmsMost } from './main';
import { StringUtility } from '@banez/string-utility';
import { createFS } from '@banez/fs';

const fs = createFS({
  base: process.cwd(),
});

function toCamelCase(s: string): string {
  return s
    .split('_')
    .map(
      (e) =>
        `${e.substring(0, 1).toUpperCase()}${e.substring(1).toLowerCase()}`,
    )
    .join('');
}

function toCamelCaseLower(s: string): string {
  return s
    .split('_')
    .map(
      (e, i) =>
        `${
          i === 0
            ? e.substring(0, 1).toLowerCase()
            : e.substring(0, 1).toUpperCase()
        }${e.substring(1).toLowerCase()}`,
    )
    .join('');
}

let bcmsConfig: BCMSMostConfig = null as never;

export const onPreInit: <T>(
  data: T,
  config: BCMSMostConfig,
) => Promise<void> = async (_data, config) => {
  try {
    bcmsConfig = config;
    await __createBcmsMost(bcmsConfig);
    await fs.save(
      'bcms.config.js',
      `module.exports = ${JSON.stringify(config)}`,
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export const createSchemaCustomization = async ({
  actions,
}: CreateSchemaCustomizationArgs) => {
  const { createTypes } = actions;
  const most = getBcmsMost();
  const result = await most.client.typeConverter.getAll({ language: 'gql' });
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    const typeString = item.content
      .replace(/Entry /g, 'Entry @dontInfer ')
      .replace(/@dontInfer \|/g, '|')
      .replace(/!,/g, '\n')
      .replace(/!!/g, '!');
    createTypes(typeString);
  }
  const templates = await most.cache.template.get();
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    createTypes(
      [
        `type Bcms${toCamelCase(template.name)}Template implements Node {`,
        `  bcms: ${toCamelCase(template.name)}Template`,
        '}',
      ].join('\n'),
    );
    createTypes(
      [
        `type Bcms${toCamelCase(template.name)} implements Node {`,
        `  bcms: ${toCamelCase(template.name)}Entry`,
        '}',
      ].join('\n'),
    );
  }
  createTypes(
    [`type BcmsMedia implements Node {`, `  bcms: BCMSMediaExtended`, '}'].join(
      '\n',
    ),
  );
};

export const sourceNodes: GatsbyNode['sourceNodes'] = async ({
  actions,
  createNodeId,
  createContentDigest,
}) => {
  const most = getBcmsMost();

  function createSource(
    name: string,
    data: BCMSEntryParsed | BCMSMediaExtended,
  ) {
    const myData = { bcms: data };
    if ((data as BCMSEntryParsed).content) {
      const dataContent = (data as BCMSEntryParsed).content;
      for (const lng in dataContent) {
        const content = dataContent[lng];
        for (let i = 0; i < content.length; i++) {
          const item = content[i];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item as any).isObject = false;
          if (typeof item.value === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item as any).isObject = true;
            item.value = JSON.stringify(item.value);
          }
        }
      }
    }
    let nodeContent = JSON.stringify(myData);
    const templateNames = StringUtility.allTextBetween(
      nodeContent,
      'templateName":"',
      '",',
    );
    for (let i = 0; i < templateNames.length; i++) {
      const templateName = templateNames[i];
      nodeContent = nodeContent.replace(
        `templateName":"${templateName}",`,
        `templateName":"${templateName}","__typename":"${toCamelCase(
          templateName,
        )}Entry","type":"${toCamelCase(templateName)}Entry",`,
      );
    }
    const nodeMeta = {
      id: createNodeId(`${name}-${data._id}`),
      parent: null,
      children: [],
      internal: {
        type: 'Bcms' + toCamelCase(name),
        mediaType: `application/json`,
        content: nodeContent,
        contentDigest: createContentDigest(myData),
      },
    };
    const node = Object.assign({}, myData, nodeMeta);
    actions.createNode(node);
  }

  try {
    const entriesData = await most.cache.content.get();
    for (const templateName in entriesData) {
      const entries = JSON.parse(
        JSON.stringify(entriesData[templateName]),
      ) as BCMSEntryParsed[];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        createSource(templateName, entry);
      }
    }
    const mediaData = await most.cache.media.get();
    for (let i = 0; i < mediaData.items.length; i++) {
      const media = mediaData.items[i];
      createSource('media', media);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

function resolveEntryPointerArray(obj: any, level?: string) {
  console.log(level);
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      if (
        obj[key] instanceof Array &&
        obj[key][0] &&
        obj[key][0].templateName
      ) {
        for (let i = 0; i < obj[key].length; i++) {
          const childObj = obj[key][i];
          resolveEntryPointerArray(childObj, `${level}.${key}[${i}]`);
          const mutated: any = {};
          mutated[toCamelCaseLower(childObj.templateName)] = childObj;
          obj[key][i] = mutated;
        }
      } else {
        if (obj[key].templateName) {
          const buffer = obj[key];
          console.log(`${level}.${key}`, { buffer });
          const newKey = toCamelCaseLower(buffer.templateName);
          obj[key] = {};
          obj[key][`${newKey}`] = buffer;
          resolveEntryPointerArray(obj[key][newKey], `${level}.${key}`);
        } else {
          resolveEntryPointerArray(obj[key], `${level}.${key}`);
        }
      }
    }
  }
}

export async function createResolvers(args: CreateResolversArgs) {
  const most = getBcmsMost();

  try {
    const tempCache = await most.cache.content.get();

    const resolvers: {
      [name: string]: {
        type?: string;
        bcms?: unknown;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve?: any;
      };
    } = {};
    for (const templateName in tempCache) {
      const nameEncoded = `${toCamelCase(templateName)}`;
      resolvers[`Bcms${nameEncoded}`] = {
        bcms: {
          type: nameEncoded + 'Entry',

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async resolve(source: any) {
            const target = JSON.parse(source.internal.content).bcms;
            let outputString = JSON.stringify(
              await most.content.entry.findOne(
                target.templateName,
                async (e) => e._id === target._id,
              ),
            );
            const templateNames = StringUtility.allTextBetween(
              outputString,
              'templateName":"',
              '",',
            );
            for (let i = 0; i < templateNames.length; i++) {
              const tn = templateNames[i];
              outputString = outputString.replace(
                `templateName":"${tn}",`,
                `templateName":"${tn}","__typename":"${toCamelCase(
                  tn,
                )}Entry","type":"${toCamelCase(tn)}Entry",`,
              );
            }
            const output = JSON.parse(outputString) as BCMSEntryParsed;
            resolveEntryPointerArray(output, 'root');
            console.log(JSON.stringify(output, null, 2));
            for (const lng in output.content) {
              output.content[lng].forEach((e) => {
                if (typeof e.value === 'object') {
                  e.value = JSON.stringify(e.value);
                }
                return e;
              });
            }
            return output;
          },
        },
      };
    }
    args.createResolvers(resolvers);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

export async function onPostBuild() {
  const most = getBcmsMost();
  await most.imageProcessor.postBuild({
    buildOutput: ['public'],
  });
  await most.server.stop();
}
