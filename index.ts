import express, { Request, Response } from "express";
import { exec } from "child_process";
import { promises as fs } from "fs";
import { IPPoolManager, createIPPoolManager } from "./ipPoolManager";

const isKubernetes = true;

const app = express();
app.use(express.json());

// WireGuard Configuration Paths
const PRIVATE_KEY_PATH = "/etc/wireguard/private.key";
const PUBLIC_KEY_PATH = "/etc/wireguard/public.key";
const CONFIG_PATH = "/etc/wireguard/wg0.conf";

// IP Pool Manager Instance
const poolManager = createIPPoolManager("10.8.0.0/24");

// Utility to execute shell commands
const executeCommand = (command: string): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(stderr || error.message);
      }
      resolve(stdout.trim());
    });
  });

const getRandomIndex = async (): Promise<number> => {
  try {
    const output = await executeCommand(
      "kubectl get pods -n auth -o jsonpath='{.items[*].metadata.name}'"
    );

    // Parse pod names that match node-wireguard
    const podNames = output.split(" ").filter((name) => name.startsWith("node-wireguard"));

    if (podNames.length === 0) {
      throw new Error("No WireGuard pods found with the prefix 'node-wireguard'");
    }

    const randomIndex = Math.floor(Math.random() * podNames.length);
    return randomIndex;
  } catch (error) {
    console.error(
      "Error fetching index:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
};

const getRandomPort = (index: number): number => {
  return 51820 + index;
};

const getPodName = async (index: number): Promise<string> => {
  const output = await executeCommand(
    "kubectl get pods -n auth -o jsonpath='{.items[*].metadata.name}'"
  );

  const podNames = output.split(" ").filter((name) => name.startsWith("node-wireguard"));

  if (index < 0 || index >= podNames.length) {
    throw new Error("Index out of range for WireGuard pods");
  }

  return podNames[index];
};

const addPeerWithKubernetes = async (
  clientPublicKey: string,
  assignedIP: string,
  index: number
): Promise<void> => {
  try {
    if (!clientPublicKey || !assignedIP || index < 0) {
      throw new Error("Invalid input provided to addPeerWithKubernetes");
    }

    const podName = await getPodName(index);
    const command = `kubectl exec ${podName} -- wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
    await executeCommand(command);
    await executeCommand("wg-quick save wg0");
  } catch (error) {
    console.error("Error in addPeerWithKubernetes:", error instanceof Error ? error.message : error);
    throw error;
  }
};

const removePeerWithKubernetes = async (
  clientPublicKey: string,
  index: number
): Promise<void> => {
  try {
    if (!clientPublicKey || index < 0) {
      throw new Error("Invalid input provided to removePeerWithKubernetes");
    }

    const podName = await getPodName(index);
    const command = `kubectl exec ${podName} -- wg set wg0 peer ${clientPublicKey} remove`;
    await executeCommand(command);
    await executeCommand("wg-quick save wg0");
  } catch (error) {
    console.error("Error in removePeerWithKubernetes:", error instanceof Error ? error.message : error);
    throw error;
  }
};

const generateKeys = async (): Promise<{
  privateKey: string;
  publicKey: string;
}> => {
  const privateKey = await executeCommand("wg genkey");
  const publicKey = await executeCommand(`echo ${privateKey} | wg pubkey`);
  return { privateKey, publicKey };
};

const saveKeys = async (
  privateKey: string,
  publicKey: string
): Promise<void> => {
  await fs.writeFile(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  await fs.writeFile(PUBLIC_KEY_PATH, publicKey, { mode: 0o600 });
};

const createConfigFile = async (privateKey: string): Promise<void> => {
  const configContent = `[Interface]
PrivateKey = ${privateKey}
Address = 10.8.0.1/24
ListenPort = 51820
SaveConfig = true
PostUp = ufw route allow in on wg0 out on eth+
PostUp = iptables -t nat -I POSTROUTING -o eth+ -j MASQUERADE
PreDown = ufw route delete allow in on wg0 out on eth+
PreDown = iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE
`;
  await fs.writeFile(CONFIG_PATH, configContent, { mode: 0o600 });
};

const createConfigFileWithKubernetes = async (privateKey: string, randomPort: number): Promise<void> => {
  const configContent = `[Interface]
PrivateKey = ${privateKey}
Address = 10.8.0.1/24
ListenPort = ${randomPort}
SaveConfig = true
PostUp = ufw route allow in on wg0 out on eth+
PostUp = iptables -t nat -I POSTROUTING -o eth+ -j MASQUERADE
PreDown = ufw route delete allow in on wg0 out on eth+
PreDown = iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE
`;
  await fs.writeFile(CONFIG_PATH, configContent, { mode: 0o600 });
};

const setupWireGuardInterface = async (): Promise<void> => {
  await executeCommand("wg-quick up wg0");
};

const addPeer = async (clientPublicKey: string, assignedIP: string): Promise<void> => {
  try {
    if (!clientPublicKey || !assignedIP) {
      throw new Error("Invalid input provided to addPeer");
    }

    const command = `wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
    await executeCommand(command);
    await executeCommand("wg-quick save wg0");
  } catch (error) {
    console.error("Error in addPeer:", error instanceof Error ? error.message : error);
    throw error;
  }
};

app.post("/add-peer", async (req: Request, res: Response): Promise<any> => {
  const { clientPublicKey } = req.body;

  if (!clientPublicKey) {
    return res.status(400).json({ error: "clientPublicKey is required" });
  }

  try {
    const assignedIP = poolManager.assignIP(clientPublicKey);

    if (assignedIP === null) {
      return res.status(500).json({ error: "No available IPs" });
    }

    let response: any = {
      message: "Peer added successfully",
      assignedIP,
    };

    if (isKubernetes) {
      const randomIndex = await getRandomIndex();
      const randomPort = getRandomPort(randomIndex);

      await addPeerWithKubernetes(clientPublicKey, assignedIP, randomIndex);

      response = {
        ...response,
        randomIndex,
        randomPort,
      };
    } else {
      await addPeer(clientPublicKey, assignedIP);
    }

    const serverPublicKey = await fs.readFile(PUBLIC_KEY_PATH, "utf-8");
    response.serverPublicKey = serverPublicKey.trim();

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      console.error("Add Peer Error:", error);
    }
  }
});

app.post("/remove-peer", async (req: Request, res: Response): Promise<any> => {
  const { clientPublicKey } = req.body;

  if (!clientPublicKey) {
    return res.status(400).json({ error: "clientPublicKey is required" });
  }

  try {
    if (isKubernetes) {
      const randomIndex = await getRandomIndex();
      await removePeerWithKubernetes(clientPublicKey, randomIndex);
    } else {
      await executeCommand(`wg set wg0 peer ${clientPublicKey} remove`);
    }

    const success = poolManager.removePeer(clientPublicKey);

    if (success) {
      res.status(200).json({ message: "Peer removed successfully" });
    } else {
      res.status(404).json({ error: "Peer not found" });
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
      console.error("Remove Peer Error:", error);
    }
  }
});

app.listen(4000, async () => {
  console.log("Server is running on http://0.0.0.0:4000");
  try {
    const { privateKey, publicKey } = await generateKeys();
    await saveKeys(privateKey, publicKey);

    if (isKubernetes) {
      const randomIndex = await getRandomIndex();
      const randomPort = getRandomPort(randomIndex);
      await createConfigFileWithKubernetes(privateKey, randomPort);
    } else {
      await createConfigFile(privateKey);
    }

    await setupWireGuardInterface();
  } catch (error) {
    console.error("Error during WireGuard setup:", error instanceof Error ? error.message : error);
  }
});



