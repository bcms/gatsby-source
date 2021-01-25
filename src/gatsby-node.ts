/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fse from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';
import { Media, SocketEventName } from '@becomes/cms-client';
import {
  BCMSMostCacheContentItem,
  BCMSMostConfig,
} from '@becomes/cms-most/types';
import { BCMSMost, BCMSMostPrototype } from '@becomes/cms-most';

let config: BCMSMostConfig;
let bcmsMost: BCMSMostPrototype;

function toCamelCase(s: string): string {
  return s
    .split('_')
    .map(
      (e) =>
        `${e.substring(0, 1).toUpperCase()}${e.substring(1).toLowerCase()}`,
    )
    .join('');
}
function createSource(
  name: string,
  _data: BCMSMostCacheContentItem | Media[],
  createNodeId: any,
  createContentDigest: any,
  createNode: any,
) {
  try {
    const data = { data: _data as any };
    for (const lng in data.data.content) {
      data.data.content[lng] = data.data.content[lng].map((e: any) => {
        if (typeof e.value !== 'string') {
          e.value = Buffer.from(
            encodeURIComponent(JSON.stringify(e.value)),
          ).toString('base64');
        }
        return e;
      });
    }
    const nodeContent = JSON.stringify(data);
    const nodeMeta = {
      id:
        data.data instanceof Array
          ? crypto.randomBytes(24).toString('hex')
          : createNodeId(
              `${name}-${
                data.data._id
                  ? data.data._id
                  : crypto.randomBytes(24).toString('hex')
              }`,
            ),
      parent: null,
      internal: {
        type: 'Bcms' + toCamelCase(name),
        mediaType: `application/json`,
        content: nodeContent,
        contentDigest: createContentDigest(data),
      },
    };
    const node = Object.assign({}, data, nodeMeta);
    createNode(node);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

export async function onPreInit<T>(
  data: T,
  ops: BCMSMostConfig,
): Promise<void> {
  try {
    config = {
      cms: ops.cms,
      entries: ops.entries ? ops.entries : [],
      functions: ops.functions ? ops.functions : [],
      media: ops.media
        ? ops.media
        : {
            output: 'static/media',
            sizeMap: [
              {
                width: 350,
              },
              {
                width: 600,
              },
              {
                width: 900,
              },
              {
                width: 1200,
              },
              {
                width: 1400,
              },
              {
                width: 1920,
              },
            ],
          },
    };
    bcmsMost = BCMSMost(config);
    bcmsMost.pipe.initialize(8001, async (name) => {
      if (name === SocketEventName.ENTRY) {
        await new Promise<void>((resolve, reject) => {
          http.get(
            'http://localhost:8000/__refresh',
            {
              method: 'POST',
            },
            (res) => {
              if (res.statusCode !== 200) {
                reject(res);
              } else {
                resolve();
              }
            },
          );
        });
      }
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
}) {
  try {
    const cache = await bcmsMost.cache.get.content();
    const { createNode } = actions;
    for (const key in cache) {
      const cacheData = cache[key];
      cacheData.forEach((data) => {
        createSource(key, data, createNodeId, createContentDigest, createNode);
      });
    }
    const mediaCache = await bcmsMost.cache.get.media();
    if (mediaCache.length > 0) {
      createSource(
        'media',
        mediaCache,
        createNodeId,
        createContentDigest,
        createNode,
      );
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
export async function createResolvers({ createResolvers }) {
  try {
    const tempCache = await bcmsMost.cache.get.content();
    const resolvers: {
      [name: string]: {
        data: any;
      };
    } = {};
    for (const key in tempCache) {
      resolvers[`Bcms${toCamelCase(key)}`] = {
        data: {
          async resolve(source: any) {
            const cache = await bcmsMost.cache.get.content();
            const type = (source.internal.type as string)
              .replace('Bcms', '')
              .split(/(?=[A-Z])/)
              .map((e) => e.toLowerCase())
              .join('');
            const target = JSON.parse(source.internal.content).data;
            const output = cache[type].find((e) => e._id === target._id) as any;
            for (const lng in output.content) {
              output.content[lng] = output.content[lng].map((e: any) => {
                if (typeof e.value !== 'string') {
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
    createResolvers(resolvers);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
export async function onPostBuild() {
  await bcmsMost.pipe.postBuild('public', 8001);
  await fse.copy(
    path.join(process.cwd(), 'static', 'media'),
    path.join(process.cwd(), 'public', 'media'),
  );
}
