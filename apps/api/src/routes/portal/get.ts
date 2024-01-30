import type { Handler } from 'express';

import logger from '@hey/lib/logger';
import parseJwt from '@hey/lib/parseJwt';
import axios from 'axios';
import { parseHTML } from 'linkedom';
import catchedError from 'src/lib/catchedError';
import getPortal from 'src/lib/oembed/meta/getPortal';
import { invalidBody, noBody } from 'src/lib/responses';
import { polygon } from 'viem/chains';
import { number, object, string } from 'zod';

type ExtensionRequest = {
  buttonIndex: number;
  postUrl: string;
  publicationId: string;
};

const validationSchema = object({
  buttonIndex: number(),
  postUrl: string(),
  publicationId: string()
});

export const post: Handler = async (req, res) => {
  const { body } = req;

  if (!body) {
    return noBody(res);
  }

  const accessToken = req.headers['x-access-token'] as string;
  const validation = validationSchema.safeParse(body);

  if (!validation.success) {
    return invalidBody(res);
  }

  const { buttonIndex, postUrl, publicationId } = body as ExtensionRequest;

  try {
    const payload = parseJwt(accessToken);
    const { evmAddress, id } = payload;

    const { data } = await axios.post(
      postUrl,
      {
        untrustedData: {
          address: evmAddress,
          buttonIndex,
          fid: id,
          network: polygon.id,
          profileId: id,
          publicationId,
          timestamp: Date.now(),
          url: postUrl
        }
      },
      { headers: { 'User-Agent': 'Twitterbot' } }
    );

    const { document } = parseHTML(data);

    logger.info(`Portal button clicked by ${id} on ${postUrl}`);

    return res.status(200).json({ portal: getPortal(document), success: true });
  } catch (error) {
    return catchedError(res, error);
  }
};