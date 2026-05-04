import { describe, it, expect } from "vitest";
import { initialState, submitGuess, advance } from "../pages/Pack/gameLogic";
import type { PackData } from "../pages/Pack/types";
import type { Player, PlayerWithTeams } from "../types";

function makePlayer(id: string, name: string): PlayerWithTeams {
  return {
    id,
    name,
    thumbnail: `https://example.com/${id}.jpg`,
    nationality: "Brazil",
    formerTeams: [
      { teamId: "club-1", teamName: "Test FC", yearJoined: "2020", yearDeparted: "2024", badge: "" },
    ],
  };
}

function makePack(playerCount = 10): PackData {
  return {
    date: "2026-05-04",
    club: { id: "club-1", name: "Test FC", badge: "" },
    players: Array.from({ length: playerCount }, (_, i) => makePlayer(`p${i + 1}`, `Player ${i + 1}`)),
  };
}

function asGuess(p: PlayerWithTeams): Player {
  return { id: p.id, name: p.name, thumbnail: p.thumbnail, nationality: p.nationality };
}

describe("pack gameLogic — initial state", () => {
  it("starts at index 0 with score 0 and status 'playing' once a pack is loaded", () => {
    const state = initialState(makePack());
    expect(state.currentIndex).toBe(0);
    expect(state.score).toBe(0);
    expect(state.guessesForCurrent).toBe(0);
    expect(state.wrongGuessesForCurrent).toEqual([]);
    expect(state.status).toBe("playing");
    expect(state.attempts).toEqual([]);
  });
});

describe("pack gameLogic — wrong guess", () => {
  it("stays on the same player and records the wrong guess", () => {
    const pack = makePack();
    const wrong: Player = { id: "intruder", name: "Wrong Guy", thumbnail: "", nationality: "" };
    const next = submitGuess(initialState(pack), wrong);

    expect(next.status).toBe("playing");
    expect(next.currentIndex).toBe(0);
    expect(next.guessesForCurrent).toBe(1);
    expect(next.wrongGuessesForCurrent).toEqual([wrong]);
    expect(next.score).toBe(0);
    expect(next.attempts).toEqual([]);
  });
});

describe("pack gameLogic — third wrong guess", () => {
  it("transitions to 'revealing' and records the attempt as failed without scoring", () => {
    const pack = makePack();
    const wrong: Player = { id: "w1", name: "Wrong One", thumbnail: "", nationality: "" };
    let state = initialState(pack);
    state = submitGuess(state, wrong);
    state = submitGuess(state, wrong);
    state = submitGuess(state, wrong);

    expect(state.status).toBe("revealing");
    expect(state.score).toBe(0);
    expect(state.guessesForCurrent).toBe(3);
    expect(state.attempts).toEqual([{ playerId: "p1", correct: false, guesses: 3 }]);
  });
});

describe("pack gameLogic — guards", () => {
  it("ignores guesses while revealing", () => {
    const pack = makePack();
    let state = initialState(pack);
    state = submitGuess(state, asGuess(pack.players[0]));
    const after = submitGuess(state, asGuess(pack.players[1]));
    expect(after).toBe(state);
  });

  it("ignores guesses when finished", () => {
    const pack = makePack(1);
    let state = initialState(pack);
    state = submitGuess(state, asGuess(pack.players[0]));
    state = advance(state);
    expect(state.status).toBe("finished");
    const after = submitGuess(state, asGuess(pack.players[0]));
    expect(after).toBe(state);
  });
});

describe("pack gameLogic — advance", () => {
  it("moves to the next player and clears per-player state", () => {
    const pack = makePack();
    let state = initialState(pack);
    state = submitGuess(state, asGuess(pack.players[0]));
    expect(state.status).toBe("revealing");

    const next = advance(state);
    expect(next.status).toBe("playing");
    expect(next.currentIndex).toBe(1);
    expect(next.guessesForCurrent).toBe(0);
    expect(next.wrongGuessesForCurrent).toEqual([]);
    expect(next.score).toBe(1);
  });

  it("transitions to 'finished' after the last player", () => {
    const pack = makePack(2);
    let state = initialState(pack);
    state = submitGuess(state, asGuess(pack.players[0]));
    state = advance(state);
    state = submitGuess(state, asGuess(pack.players[1]));
    state = advance(state);

    expect(state.status).toBe("finished");
    expect(state.score).toBe(2);
    expect(state.attempts).toHaveLength(2);
  });
});

describe("pack gameLogic — correct guess", () => {
  it("transitions to 'revealing', increments score, and records the attempt", () => {
    const pack = makePack();
    const state = initialState(pack);
    const next = submitGuess(state, asGuess(pack.players[0]));

    expect(next.status).toBe("revealing");
    expect(next.score).toBe(1);
    expect(next.attempts).toHaveLength(1);
    expect(next.attempts[0]).toEqual({ playerId: "p1", correct: true, guesses: 1 });
    expect(next.currentIndex).toBe(0);
  });
});
