import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, arbitrum, base } from '@reown/appkit/networks'

// 1. Get projectId
const projectId = 'b56e18d47c72e20f66d2105e46830707' // Provided by user or new one

// 2. Set the networks
const networks = [base, mainnet, arbitrum]

// 3. Create a metadata object - optional
const metadata = {
    name: 'L\'Horizon Crypto',
    description: 'Apprenez et gagnez des crypto',
    url: 'https://ebook-horizoncrypto.com', // origin must match your domain & subdomain
    icons: ['https://ebook-horizoncrypto.com/assets/logo-horizon-crypto.png']
}

// 4. Create the AppKit instance
const modal = createAppKit({
    adapters: [new EthersAdapter()],
    networks,
    metadata,
    projectId,
    features: {
        analytics: true
    }
})

// 5. Expose open function globally so index.html button can call it
window.openWalletModal = () => modal.open()
