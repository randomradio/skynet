import { SandboxClient } from "@agent-infra/sandbox";

const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8180";
const sandbox = new SandboxClient({ environment: SANDBOX_URL });

async function main() {
  console.log("--- Test shell.execCommand ---");
  try {
    const result = await sandbox.shell.execCommand({ command: "echo hello from shell" });
    console.log("shell ok:", result.ok);
    if (result.ok) {
      console.log("shell body:", JSON.stringify(result.body, null, 2));
    } else {
      console.log("shell error:", JSON.stringify(result.error, null, 2));
    }
  } catch (err) {
    console.log("shell exception:", err);
  }

  console.log("\n--- Test bash.exec ---");
  try {
    const result = await sandbox.bash.exec({ command: "echo hello from bash && pwd", timeout: 10 });
    console.log("bash ok:", result.ok);
    if (result.ok) {
      console.log("bash body:", JSON.stringify(result.body, null, 2));
    } else {
      console.log("bash error:", JSON.stringify(result.error, null, 2));
    }
  } catch (err) {
    console.log("bash exception:", err);
  }

  console.log("\n--- Test git clone (public repo) ---");
  try {
    const result = await sandbox.bash.exec({
      command: "mkdir -p /home/gem/repos/randomradio && git clone --depth 10 https://github.com/randomradio/day1.git /home/gem/repos/randomradio/day1 2>&1",
      timeout: 120,
    });
    console.log("clone ok:", result.ok);
    if (result.ok) {
      console.log("clone stdout:", result.body.data?.stdout);
      console.log("clone stderr:", result.body.data?.stderr);
      console.log("clone exit_code:", result.body.data?.exit_code);
      console.log("clone status:", result.body.data?.status);
    } else {
      console.log("clone error:", JSON.stringify(result.error, null, 2));
    }
  } catch (err) {
    console.log("clone exception:", err);
  }

  console.log("\n--- Check if repo exists ---");
  try {
    const result = await sandbox.bash.exec({ command: "ls -la /home/gem/repos/randomradio/day1/ 2>&1", timeout: 10 });
    console.log("ls ok:", result.ok);
    if (result.ok) {
      console.log("ls stdout:", result.body.data?.stdout);
      console.log("ls exit_code:", result.body.data?.exit_code);
    }
  } catch (err) {
    console.log("ls exception:", err);
  }
}

main().catch(console.error);
