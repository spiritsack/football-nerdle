import { MAX_ATTEMPTS } from "../GuessThePlayer/constants";
import { TURN_TIME } from "../../constants";
import type { GameModeKey, HowToPlayContent } from "./types";

export const HOW_TO_PLAY: Record<GameModeKey, HowToPlayContent> = {
  guess: {
    title: "Guess the Player",
    rules: [
      "Guess the footballer from their club history.",
      `You have ${MAX_ATTEMPTS} attempts to get it right.`,
      "Each wrong guess reveals a hint: nationality, then age, position and finally a photo.",
      "Hard mode (on by default) shows only club badges, with no names or years.",
      "The Daily Challenge is the same player for everyone; use the Archive to play past days.",
    ],
  },
  battle: {
    title: "Battle Mode",
    rules: [
      "Name a player who shared a club with the current player during overlapping years.",
      `You have ${TURN_TIME} seconds per turn.`,
      "A wrong answer or running out of time ends the game.",
      "Build the longest chain you can, solo or against a friend in online multiplayer.",
    ],
  },
};
