import { GameAgent, GameWorker, LLMModel } from "@virtuals-protocol/game";
import TwitterPlugin from "@virtuals-protocol/game-twitter-plugin";
import { TwitterApi } from "@virtuals-protocol/game-twitter-node";
// import { TwitterWorker } from "./twitterWorker";
import dotenv from "dotenv";
import AlchemyPlugin from "./alchemyPlugin";

dotenv.config();

if (!process.env.VIRTUALS_API_TOKEN) {
    throw new Error('VIRTUALS_API_TOKEN is required in environment variables');
}

if (!process.env.GAME_TWITTER_ACCESS_TOKEN) {
    throw new Error('GAME_TWITTER_ACCESS_TOKEN is required in environment variables');
}

if (!process.env.ALCHEMY_API_KEY) {
    throw new Error('ALCHEMY_API_KEY is required in environment variables');
}

const alchemyPlugin = new AlchemyPlugin({
    credentials: {
        apiKey: process.env.ALCHEMY_API_KEY || "",
    },
});

const gameTwitterClient = new TwitterApi({
  gameTwitterAccessToken: process.env.GAME_TWITTER_ACCESS_TOKEN,
});

// const nativeTwitterClient = new TwitterApi({
//   appKey: "xxxxxxx",
//   appSecret: "xxxxxxx",
//   accessToken: "xxxxxxx",
//   accessSecret: "xxxxxxxxx",
// });

// Create a worker with the functions
const twitterPlugin = new TwitterPlugin({
  id: "twitter_worker",
  name: "Twitter Worker",
  description:
    "A worker that will execute tasks within the Twitter Social Platforms. It is capable of posting, reply, quote and like tweets.",
  twitterClient: gameTwitterClient,
});


export const activity_agent = new GameAgent(process.env.VIRTUALS_API_TOKEN, {
    name: "XAO Arbitration Agent",
    goal: "find tweets from @btreeOrion or tweets that mention @btreeOrion",
    description: "A bot that can post tweets, reply to tweets, and like tweets",
    workers: [
        alchemyPlugin.getWorker(),
        // TwitterWorker
        new GameWorker({
            id: "twitter_worker",
            name: "Twitter Worker",
            description: "Twitter integration worker",
            functions: [
                twitterPlugin.searchTweetsFunction,
                //twitterPlugin.replyTweetFunction,
                //twitterPlugin.postTweetFunction,
            ],
            getEnvironment: async () => {
                return {
                ...(await twitterPlugin.getMetrics()),
                username: "virtualsprotocol",
                token_price: "$100.00",
                };
            },
        }),
    ]
});

activity_agent.setLogger((agent: GameAgent, msg: string) => {
    console.log(`🎯 [${agent.name}]`);
    console.log(msg);
    console.log("------------------------\n");
}); 