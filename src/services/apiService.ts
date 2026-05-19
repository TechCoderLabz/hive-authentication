/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Discussion } from '../types/comment';
import type { TrendingTag } from '../types/trending';
import type { ThreeSpeakVideo, ActiveVote } from '../types/video';

const server = {
  domain: 'https://studio.3speak.tv',
  kThreeSpeakApiUrl: 'https://studio.3speak.tv/mobile/api',
  userOwnerThumb: (username: string) => `https://images.hive.blog/u/${username}/avatar`,
  graphQLServerUrl: 'https://union.us-02.infra.3speak.tv',
};
import { Client } from '@hiveio/dhive';
import { getHiveAuthApiNode, subscribeHiveAuthApiNode } from '../config/hiveApi';

// Primary node is whatever the host app configured via
// `setHiveAuthApiNode(...)`; the two extras serve as in-process
// failover so an unreachable primary doesn't take a feed query down
// before the host's wider failover kicks in. The address array is
// patched in place when the host swaps nodes so live calls follow.
const dhiveClient = new Client([
  getHiveAuthApiNode(),
  'https://api.syncad.com',
  'https://api.deathwing.me',
]);
subscribeHiveAuthApiNode((url) => {
  dhiveClient.address = [url, 'https://api.syncad.com', 'https://api.deathwing.me'];
});

class ApiService {

  async handleUpvote({
    author,
    permlink,
    weight,
    authToken,
  }: {
    author: string;
    permlink: string;
    weight: number;
    authToken: string;
  }): Promise<Record<string, any>> {
    const url = `${server.domain}/mobile/vote`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': authToken
      },
      body: JSON.stringify({
        author,
        permlink,
        weight,
      }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Unknown API error');
    }
  }

  async handleComment({
    author,
    permlink,
    body,
    authToken,
  }: {
    author: string;
    permlink: string;
    body: string;
    authToken: string;
  }): Promise<Record<string, Discussion>> {
    const url = `${server.domain}/mobile/comment`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': authToken
      },
      body: JSON.stringify({
        author,
        permlink,
        comment: body,
      }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Unknown API error');
    }
  }

  async getUserVideos(username: string, skip = 0): Promise<ThreeSpeakVideo[]> {
    const url = `${server.kThreeSpeakApiUrl}/feed/user/@${username}?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch user videos:', response.statusText);
      return [];
    }
  }

  async getHomeVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const url = `${server.kThreeSpeakApiUrl}/feed/home?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch home videos:', response.statusText);
      return [];
    }
  }

  async getTrendingVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const url = `${server.kThreeSpeakApiUrl}/feed/trending?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch trending videos:', response.statusText);
      return [];
    }
  }

  async getNewVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const url = `${server.kThreeSpeakApiUrl}/feed/new?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch new videos:', response.statusText);
      return [];
    }
  }

  async getFirstUploadsVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const url = `${server.kThreeSpeakApiUrl}/feed/first?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch first uploads:', response.statusText);
      return [];
    }
  }

  async getVideoDetails(username: string, permlink: string): Promise<ThreeSpeakVideo | null> {
    const url = `${server.kThreeSpeakApiUrl}/video/@${username}/${permlink}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.error('Failed to fetch video details:', response.statusText);
      return null;
    }
  }

  async getCommunityVideos(community: string, skip = 0): Promise<ThreeSpeakVideo[]> {
    const url = `${server.kThreeSpeakApiUrl}/feed/community/@${community}?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch community videos:', response.statusText);
      return [];
    }
  }

  async getRelatedVideos(username: string, skip = 0): Promise<ThreeSpeakVideo[]> {
    const url = `${server.kThreeSpeakApiUrl}/feed/@${username}?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch related videos:', response.statusText);
      return [];
    }
  }

  async getTrendingTags(): Promise<TrendingTag[]> {
    const gqlServer = `${server.graphQLServerUrl}/api/v2/graphql`;
    const query = `
      query TrendingTags {
        trendingTags(limit: 50) {
          tags {
            score
            tag
          }
        }
      }
    `;

    try {
      const response = await fetch(gqlServer, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          operationName: 'TrendingTags',
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const json = await response.json();

      if (json.errors) {
        throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`);
      }

      return json.data?.trendingTags?.tags || [];
    } catch (error) {
      console.error('Failed to fetch trending tags:', error);
      throw error;
    }
  }

  async getTaggedVideos(tag: string, skip = 0): Promise<any[]> {
    const gqlServer = `${server.graphQLServerUrl}/api/v2/graphql`;
    const query = `
      query TrendingTagFeed($tag: String, $skip: Int) {
        trendingFeed(
          spkvideo: { only: true }
          feedOptions: { byTag: { _eq: $tag } }
          pagination: { limit: 20, skip: $skip }
        ) {
          items {
            created_at
            title
            ... on HivePost {
              permlink
              lang
              title
              tags
              spkvideo
              stats {
                num_comments
                num_votes
                total_hive_reward
              }
              author {
                username
              }
              json_metadata {
                raw
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(gqlServer, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          operationName: 'TrendingTagFeed',
          variables: {
            tag: tag,
            skip: skip,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const json = await response.json();

      if (json.errors) {
        throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`);
      }

      return json.data?.trendingFeed?.items || [];
    } catch (error) {
      console.error('Failed to fetch tagged videos:', error);
      throw error;
    }
  }

  async getSearchFeed(term: string, skip = 0, lang?: string): Promise<any[]> {
    const gqlServer = `${server.graphQLServerUrl}/api/v2/graphql`;
    const query = `
      query SearchFeed {
        searchFeed(
          searchTerm: "${term}"
          spkvideo: { only: true }
          feedOptions: { ${lang ? `byLang: {_eq: "${lang}"}` : ''} }
          pagination: { limit: 20, skip: ${skip} }
        ) {
          items {
            created_at
            title
            ... on HivePost {
              permlink
              lang
              title
              tags
              spkvideo
              stats {
                num_comments
                num_votes
                total_hive_reward
              }
              author {
                username
              }
              json_metadata {
                raw
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(gqlServer, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          operationName: 'SearchFeed',
        }),
      });

      if (!response.ok) throw new Error(`GraphQL request failed: ${response.statusText}`);

      const json = await response.json();

      if (json.errors) throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`);

      return json.data?.searchFeed?.items || [];
    } catch (error) {
      console.error('Failed to fetch search results:', error);
      throw error;
    }
  }

  async getContentStats(author: string, permlink: string) {
    try {
      const result: any = await dhiveClient.call(
        "condenser_api",
        "get_content",
        [author, permlink]
      );
      return {
        numOfUpvotes: result?.net_votes ?? 0,
        numOfComments: result?.children ?? 0,
        hiveValue: result?.pending_payout_value
          ? parseFloat(result.pending_payout_value)
          : 0
      };
    } catch (error) {
      return {
        numOfUpvotes: 0,
        numOfComments: 0,
        hiveValue: 0
      };
    }
  }

  async getActiveVotes(author: string, permlink: string): Promise<ActiveVote[]> {
    try {
      const result = await dhiveClient.call(
        "condenser_api",
        "get_active_votes",
        [author, permlink]
      );
      return result as ActiveVote[];
    } catch (error) {
      console.error("Error calling get_active_votes:", error);
      return [];
    }
  }

  async getCommentsList(author: string, permlink: string): Promise<Discussion[]> {
    try {
      const rawResult: unknown = await dhiveClient.call(
        "bridge",
        "get_discussion",
        [author, permlink]
      );

      // The bridge API may return either an array of discussions or
      // an object keyed by "author/permlink" → Discussion.
      const list: Discussion[] = Array.isArray(rawResult)
        ? (rawResult as Discussion[])
        : rawResult && typeof rawResult === 'object'
          ? Object.values(rawResult as Record<string, Discussion>)
          : [];

      return list.map((comment) => {
        // Normalize depth as number and ensure required fields exist
        const rawDepth: unknown = (comment as unknown as Record<string, unknown>).depth;
        if (typeof rawDepth === 'string') {
          const parsed = parseInt(rawDepth, 10);
          comment.depth = Number.isFinite(parsed) ? parsed : 0;
        } else if (typeof rawDepth !== 'number' || !Number.isFinite(rawDepth)) {
          comment.depth = comment.depth ?? 0;
        }

        // Safely parse json_metadata only when it's a JSON string.
        // If it's already an object, use it directly. Ignore invalid cases.
        const jm: unknown = (comment as unknown as Record<string, unknown>).json_metadata as unknown;
        try {
          if (jm && typeof jm === 'string') {
            const trimmed = jm.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              comment.json_metadata_parsed = JSON.parse(trimmed);
            }
          } else if (jm && typeof jm === 'object') {
            // Already parsed object
            comment.json_metadata_parsed = jm as Record<string, unknown>;
          }
        } catch (e) {
          // Log once per comment succinctly; server returns sometimes non-JSON like "[object Object]"
          console.warn(`Skipped invalid json_metadata for ${comment.author}/${comment.permlink}`);
        }
        return comment;
      });
    } catch (error) {
      console.error('Error fetching comments list:', error);
      return [];
    }
  }

  async getMyVideos(authToken: string): Promise<ThreeSpeakVideo[]> {
    const url = `${server.domain}/mobile/api/my-videos`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error('Failed to fetch my videos:', response.statusText);
      throw new Error(`Failed to fetch my videos: ${response.status}`);
    }
  }
}

export const apiService = new ApiService();
export { server };