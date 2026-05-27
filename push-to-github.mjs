import { Client } from 'ssh2';

const VPS = {
  host: '103.67.244.19',
  port: 22,
  username: 'root',
  password: 'Akumuak_01',
};

const GITHUB_REPO = 'git@github.com:a68499375-create/kuislatihanbahasajepang.git';

function sshExec(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve({ code: -1, stdout: '', stderr: err.message });
      let stdout = '', stderr = '';
      stream.on('data', (d) => { stdout += d.toString(); });
      stream.stderr.on('data', (d) => { stderr += d.toString(); });
      stream.on('close', (code) => {
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
  });
}

async function run() {
  const conn = new Client();
  conn.on('ready', async () => {
    try {
      console.log('🔄 Checking .gitignore on the VPS to protect private data (.env)...');
      const gitignore = await sshExec(conn, 'cat /home/nihongo-master/.gitignore');
      console.log('.gitignore contents:');
      console.log(gitignore.stdout || gitignore.stderr);

      // Make sure .env and node_modules are in .gitignore
      let hasEnv = gitignore.stdout.includes('.env');
      let hasNodeModules = gitignore.stdout.includes('node_modules');
      if (!hasEnv || !hasNodeModules) {
        console.log('🔄 Adding .env and node_modules to .gitignore...');
        await sshExec(conn, 'echo "\n.env\nnode_modules/\ndist/\n.antigravity/\n*.log" >> /home/nihongo-master/.gitignore');
      }

      console.log('\n🔄 Configuring Git user credentials on the VPS...');
      await sshExec(conn, 'git config --global user.name "a68499375-create"');
      await sshExec(conn, 'git config --global user.email "admin@kuislatihanbahasajepang.web.id"');

      console.log('\n🔄 Initializing Git repository inside /home/nihongo-master...');
      await sshExec(conn, 'cd /home/nihongo-master && git init');

      console.log('\n🔄 Adding files to Git staging...');
      await sshExec(conn, 'cd /home/nihongo-master && git add .');

      console.log('\n🔄 Creating initial commit...');
      const commit = await sshExec(conn, 'cd /home/nihongo-master && git commit -m "Initial commit: Kuis & Kamus Bahasa Jepang with PWA, Google Auth, and Cloudflare Turnstile"');
      console.log(commit.stdout || commit.stderr);

      console.log('\n🔄 Setting branch name to main...');
      await sshExec(conn, 'cd /home/nihongo-master && git branch -M main');

      console.log('\n🔄 Adding remote origin...');
      // Remove old remote if exists, then add new
      await sshExec(conn, 'cd /home/nihongo-master && git remote remove origin 2>/dev/null');
      const remoteResult = await sshExec(conn, `cd /home/nihongo-master && git remote add origin ${GITHUB_REPO}`);
      console.log(remoteResult.stdout || 'Remote origin configured.');

      console.log('\n🔄 Pushing to GitHub repository...');
      const pushResult = await sshExec(conn, 'cd /home/nihongo-master && git push -u origin main');
      console.log('Push stdout:');
      console.log(pushResult.stdout);
      console.log('Push stderr (Git prints progress here):');
      console.log(pushResult.stderr);

      if (pushResult.code === 0) {
        console.log('\n🎉🎉🎉 SUCCESSFULLY UPLOADED TO GITHUB! 🎉🎉🎉');
      } else {
        console.error('\n⚠️ Push failed. Please make sure you completed Step 1 (adding SSH Key to GitHub).');
      }

      conn.end();
    } catch (e) {
      console.error(e);
      conn.end();
    }
  });
  conn.connect(VPS);
}

run();
