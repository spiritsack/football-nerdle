export interface Player {
  id: string;
  name: string;
  thumbnail: string;
  nationality: string;
}

export interface FormerTeam {
  teamId: string;
  teamName: string;
  yearJoined: string;
  yearDeparted: string;
  badge: string;
}

export interface PlayerWithTeams extends Player {
  formerTeams: FormerTeam[];
}
