import { GameAgent } from "@virtuals-protocol/game";
import dotenv from "dotenv";
import { TwitterWorker } from "./twitterWorker";
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

export const activity_agent = new GameAgent(process.env.VIRTUALS_API_TOKEN, {
    name: "XAO Arbitration Agent",
    goal: "find tweets from @btreeOrion or tweets that mention @btreeOrion",
    description: "A bot that can post tweets, reply to tweets, and like tweets",
    workers: [
        alchemyPlugin.getWorker(),
        TwitterWorker        
    ]
});

activity_agent.setLogger((agent: GameAgent, msg: string) => {
    console.log(`🎯 [${agent.name}]`);
    console.log(msg);
    console.log("------------------------\n");
}); 