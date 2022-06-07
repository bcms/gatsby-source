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

function toCamelCase(s: string): string {
  return s
    .split('_')
    .map(
      (e) =>
        `${e.substring(0, 1).toUpperCase()}${e.substring(1).toLowerCase()}`,
    )
    .join('');
}

export const onPreInit: <T>(
  data: T,
  config: BCMSMostConfig,
) => Promise<void> = async (_data, config) => {
  try {
    await __createBcmsMost(config);
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
    createTypes(item.content.replace(/Entry /g, 'Entry @dontInfer '));
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
          if (typeof item.value === 'object') {
            item.value = JSON.stringify(item.value);
          }
        }
      }
    }
    const nodeContent = JSON.stringify(myData);
    console.log(name, myData);
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
        console.log('T --->', templateName);
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

export async function createResolvers(args: CreateResolversArgs) {
  const most = getBcmsMost();

  try {
    const tempCache = await most.cache.content.get();

    const resolvers: {
      [name: string]: {
        type?: string;
        bcms?: unknown;
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
            const type = (source.internal.type as string)
              .replace('Bcms', '')
              .split(/(?=[A-Z])/)
              .map((e) => e.toLowerCase())
              .join('_');
            const target = JSON.parse(source.internal.content).bcms;
            const output = JSON.parse(
              JSON.stringify(
                await most.cache.content.findOneInGroup(
                  type,
                  (e) => e._id === target._id,
                ),
              ),
            ) as BCMSEntryParsed;
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
}
