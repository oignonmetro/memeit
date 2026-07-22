import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useGameStore } from './state/gameStore';
import Home from './pages/Home';
import RoomPage from './pages/RoomPage';
import TvPage from './pages/TvPage';

export default function App() {
  const initListeners = useGameStore((s) => s.initListeners);

  useEffect(() => {
    initListeners();
  }, [initListeners]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/tv" element={<TvPage />} />
        <Route path="/tv/:code" element={<TvPage />} />
      </Routes>
    </HashRouter>
  );
}
