
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Activation Discord | L\'Horizon Crypto',
    description: 'Activez votre accès exclusif au Discord de L\'Horizon Crypto.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="fr">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
