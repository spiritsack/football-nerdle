export interface TopClub {
  id: string;
  name: string;
  league: string;
  country: string;
}

export const TOP_CLUBS: TopClub[] = [
  // Premier League
  { id: "133604", name: "Arsenal", league: "English Premier League", country: "England" },
  { id: "133610", name: "Chelsea", league: "English Premier League", country: "England" },
  { id: "133602", name: "Liverpool", league: "English Premier League", country: "England" },
  { id: "133613", name: "Manchester City", league: "English Premier League", country: "England" },
  { id: "133612", name: "Manchester United", league: "English Premier League", country: "England" },
  { id: "133616", name: "Tottenham Hotspur", league: "English Premier League", country: "England" },
  // La Liga
  { id: "133738", name: "Real Madrid", league: "Spanish La Liga", country: "Spain" },
  { id: "133739", name: "Barcelona", league: "Spanish La Liga", country: "Spain" },
  { id: "133729", name: "Atlético Madrid", league: "Spanish La Liga", country: "Spain" },
  // Serie A
  { id: "133676", name: "Juventus", league: "Italian Serie A", country: "Italy" },
  { id: "133667", name: "AC Milan", league: "Italian Serie A", country: "Italy" },
  { id: "133681", name: "Inter Milan", league: "Italian Serie A", country: "Italy" },
  { id: "133670", name: "Napoli", league: "Italian Serie A", country: "Italy" },
  // Bundesliga
  { id: "133664", name: "Bayern Munich", league: "German Bundesliga", country: "Germany" },
  { id: "133650", name: "Borussia Dortmund", league: "German Bundesliga", country: "Germany" },
  // Ligue 1
  { id: "133714", name: "Paris SG", league: "French Ligue 1", country: "France" },
  { id: "133707", name: "Marseille", league: "French Ligue 1", country: "France" },
  { id: "133713", name: "Lyon", league: "French Ligue 1", country: "France" },
  // Other
  { id: "133772", name: "Ajax", league: "Dutch Eredivisie", country: "Netherlands" },
  { id: "134114", name: "FC Porto", league: "Portuguese Primeira Liga", country: "Portugal" },
  { id: "134108", name: "Benfica", league: "Portuguese Primeira Liga", country: "Portugal" },
];
