import { GameWorker } from "@virtuals-protocol/game";
import TwitterPlugin from "@virtuals-protocol/game-twitter-plugin";
import { TwitterApi } from "@virtuals-protocol/game-twitter-node";

const gameTwitterClient = new TwitterApi({
  gameTwitterAccessToken: process.env.GAME_TWITTER_ACCESS_TOKEN,
});

// Create a worker with the functions
const twitterPlugin = new TwitterPlugin({
  id: "twitter_worker",
  name: "Twitter Worker",
  description:
    "A worker that will execute tasks within the Twitter Social Platforms. It is capable of posting, reply, quote and like tweets.",
  twitterClient: gameTwitterClient,
});

// Create a demo worker with our functions
export const TwitterWorker = new GameWorker({
  id: "twitter_worker",
  name: "Twitter Worker",
  description: "Twitter integration worker",
  functions: [twitterPlugin.searchTweetsFunction],
  getEnvironment: async () => {
    return {
      ...(await twitterPlugin.getMetrics()),
      username: "xao_ai_bot",
    };
  },
});
