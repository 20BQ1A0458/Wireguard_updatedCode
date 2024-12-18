import express, { Request, Response } from "express";
import { exec } from "child_process";
import { promises as fs } from "fs";
import { IPPoolManager, createIPPoolManager } from "./ipPoolManager";

const isKubernetes = true;

const app = express();
app.use(express.json());

// WireGuard Configuration Paths
const PRIVATE_KEY_PATH = "/etc/wireguard/privatekey";
const PUBLIC_KEY_PATH = "/etc/wireguard/publickey";
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

const getPodNameByIndex = async (index: number): Promise<string> => {
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
  podName: string
): Promise<void> => {
  try {
    const command = `kubectl exec -n auth ${podName} -- wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
    await executeCommand(command);
  } catch (error) {
    console.error("Error in addPeerWithKubernetes:", error instanceof Error ? error.message : error);
    throw error;
  }
};

const addPeer = async (clientPublicKey: string, assignedIP: string): Promise<void> => {
  try {
    const command = `wg set wg0 peer ${clientPublicKey} allowed-ips ${assignedIP}/32`;
    await executeCommand(command);
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
      const randomIndex = Math.floor(Math.random() * 2); // Adjust this based on the number of replicas
      const podName = await getPodNameByIndex(randomIndex);

      await addPeerWithKubernetes(clientPublicKey, assignedIP, podName);

      response = {
        ...response,
        podName,
        randomIndex,
      };
    } else {
      await addPeer(clientPublicKey, assignedIP);
    }

    const serverPublicKey = await fs.readFile(PUBLIC_KEY_PATH, "utf-8");
    response.serverPublicKey = serverPublicKey.trim();

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "An error occurred" });
    console.error("Add Peer Error:", error);
  }
});

app.listen(4000, () => {
  console.log("Server is running on http://0.0.0.0:4000");
});
