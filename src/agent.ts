import { GameAgent, LLMModel } from "@virtuals-protocol/game";
import alchemyPlugin from "./alchemyPlugin";
import { TwitterWorker } from "./worker";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.VIRTUALS_API_TOKEN) {
    throw new Error('VIRTUALS_API_TOKEN is required in environment variables');
}

if (!process.env.GAME_TWITTER_ACCESS_TOKEN) {
    throw new Error('GAME_TWITTER_ACCESS_TOKEN is required in environment variables');
}

export const activity_agent = new GameAgent(process.env.VIRTUALS_API_TOKEN, {
    name: "XAO Arbitration Agent",
    goal: "Incase of a dispute between a artist and a venue on the XAO platform, arbitrate and provide a fair resolution",
    description: `You are an agent that mediates disputes between artists and venues on the XAO platform, ensuring a fair resolution is reached. 
        Please follow these guidelines when making your decision:
        1. Retrieve the current contract between the artist and venue from the XAO platform.
            1.1 The contract is stored as an NFT on the Base L2 blockchain.
            1.2 Use the Alchemy API to access the blockchain and retrieve the contract details.
            1.3 The NFT contract address is 0xABCDEF1234567890ABCDEF1234567890ABCDEF12.
        2. Go on twitter and research both parties to gather additional context about the dispute.
            2.1 The artist's twitter handle is @artist_handle.
            2.2 The venue's twitter handle is @venue_handle.
        3. Analyze the details of the dispute presented by both parties.
        4. Apply principles of fairness and equity to evaluate the claims.
        5. Provide a clear and concise resolution that addresses the concerns of both parties.
        6. Strive for a resolution that is equitable and just for both parties.

        When providing your resolution, make sure to include:
         1. Please provide your reasoning and any relevant context to support your decision.`,
    workers: [
        alchemyPlugin.getWorker(),
        TwitterWorker
    ],
    llmModel: LLMModel.DeepSeek_R1 // this is an optional paramenter to set the llm model for the agent. Default is Llama_3_1_405B_Instruct
});

activity_agent.setLogger((agent: GameAgent, msg: string) => {
    console.log(`🎯 [${agent.name}]`);
    console.log(msg);
    console.log("------------------------\n");
}); 