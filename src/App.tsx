import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Game from "./components/Game";
import GuessGame from "./components/GuessGame";
import MultiplayerLobby from "./components/MultiplayerLobby";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/battle" element={<Game />} />
        <Route path="/battle/multiplayer" element={<MultiplayerLobby />} />
        <Route path="/guess" element={<GuessGame />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
