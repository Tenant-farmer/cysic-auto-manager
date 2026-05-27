import { SigningStargateClient, GasPrice, StargateClient } from "@cosmjs/stargate";
import { OfflineDirectSigner } from "@cosmjs/proto-signing";
import { getCysic } from "../config/chains";

let readOnly: StargateClient | null = null;

export async function getReadClient(): Promise<StargateClient> {
  if (!readOnly) {
    readOnly = await StargateClient.connect(getCysic().rpc);
  }
  return readOnly;
}

export async function getSigningClient(
  signer: OfflineDirectSigner
): Promise<SigningStargateClient> {
  const c = getCysic();
  return SigningStargateClient.connectWithSigner(c.rpc, signer, {
    gasPrice: GasPrice.fromString(c.gasPrice),
  });
}
