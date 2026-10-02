import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import GuildPicker from './pages/GuildPicker.jsx';
import Overview from './pages/Overview.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Settings from './pages/Settings.jsx';
import Personalizer from './pages/Personalizer.jsx';
import Health from './pages/Health.jsx';
import ModulePage from './pages/ModulePage.jsx';
import Messages from './pages/Messages.jsx';
import MessageBuilder from './pages/MessageBuilder.jsx';
import Insights from './pages/Insights.jsx';
import Commands from './pages/Commands.jsx';
import AppealsReview from './pages/AppealsReview.jsx';
import TicketsInbox from './pages/TicketsInbox.jsx';
import TicketView from './pages/TicketView.jsx';
import ModerationHub from './pages/ModerationHub.jsx';

export default function App() {
  return (
    <BrowserRouter basename="/v2">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<GuildPicker />} />
          <Route path="guilds/:guildId" element={<Overview />} />
          <Route path="guilds/:guildId/leaderboard" element={<Leaderboard />} />
          <Route path="guilds/:guildId/settings" element={<Settings />} />
          <Route path="guilds/:guildId/m/:moduleId" element={<ModulePage />} />
          <Route path="guilds/:guildId/messages" element={<Messages />} />
          <Route path="guilds/:guildId/messages/:id" element={<MessageBuilder />} />
          <Route path="guilds/:guildId/insights" element={<Insights />} />
          <Route path="guilds/:guildId/commands" element={<Commands />} />
          <Route path="guilds/:guildId/appeals" element={<AppealsReview />} />
          <Route path="guilds/:guildId/tickets" element={<TicketsInbox />} />
          <Route path="guilds/:guildId/tickets/:ticketId" element={<TicketView />} />
          <Route path="guilds/:guildId/moderation" element={<ModerationHub />} />
          <Route path="settings" element={<Personalizer />} />
          <Route path="health" element={<Health />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
