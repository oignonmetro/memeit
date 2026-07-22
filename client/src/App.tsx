import { HashRouter, Routes, Route } from 'react-router-dom';
import { firebaseConfigured } from './lib/firebase';
import Home from './pages/Home';
import RoomPage from './pages/RoomPage';
import TvPage from './pages/TvPage';

function FirebaseSetupScreen() {
  return (
    <div className="screen">
      <h1 className="title">
        Meme<span className="accent">It</span>
      </h1>
      <div className="card">
        <p>
          Firebase n'est pas configuré. Renseigne les variables <code>VITE_FIREBASE_*</code> (voir{' '}
          <code>.env.example</code>) puis relance l'application.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!firebaseConfigured) {
    return <FirebaseSetupScreen />;
  }

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
