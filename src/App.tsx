import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Battle from "./pages/Battle";
import GuessThePlayer from "./pages/GuessThePlayer";
import GuessArchive from "./pages/GuessThePlayer/Archive";
import MultiplayerBattle from "./pages/MultiplayerBattle";

const Admin = lazy(() => import("./pages/Admin"));

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/battle" element={<Battle />} />
        <Route path="/battle/multiplayer" element={<MultiplayerBattle />} />
        <Route path="/guess" element={<GuessThePlayer />} />
        <Route path="/guess/archive" element={<GuessArchive />} />
        <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
