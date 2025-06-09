// PROJET-GIT/node/server.js

process.on("unhandledRejection", (reason, promise) => {
    console.error("*** UNHANDLED REJECTION in repo-analyzer ***");
    console.error("Promise:", promise);
    console.error("Reason:", reason);
    if (reason && reason.stack) {
        console.error(reason.stack);
    }
    process.exit(1);
});

// Importation des modules nécessaires
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 2000;

app.use(express.json());

app.post('/analyze', async (req, res) => {
    console.log(`[Node Service] Received analysis request from Flask.`);

    const { repo_url, history, factor, elastic_username, elastic_password } = req.body;

    if (!repo_url) {
        console.error('[Node Service] Error: repo_url is missing in the request body.');
        return res.status(400).json({ error: 'repo_url est requis dans la requête.' });
    }

    const tempDir = fs.mkdtempSync(path.join('/tmp/', 'repo-clone-'));
    const localRepoPath = path.join(tempDir, 'cloned_repo');

    let stderrOutput = '';
    let stdoutOutput = '';

    try {
        console.log(`[Node Service] Attempting to clone ${repo_url} into ${localRepoPath}...`);

        const gitCloneProcess = spawn('git', ['clone', repo_url, localRepoPath], { cwd: tempDir });

        await new Promise((resolve, reject) => {
            gitCloneProcess.stderr.on('data', (data) => console.error(`[Node Service] git clone stderr: ${data.toString().trim()}`));
            gitCloneProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('[Node Service] Git clone successful.');
                    resolve();
                } else {
                    console.error(`[Node Service] Git clone failed with exit code ${code}`);
                    reject(new Error(`Git clone failed with code ${code}`));
                }
            });
            gitCloneProcess.on('error', (err) => {
                console.error(`[Node Service] Failed to start git clone process: ${err}`);
                reject(err);
            });
        }).catch(err => {
            console.error('[Node Service] Error during git clone:', err);
            throw err;
        });

        console.log(`[Node Service] Starting repo-analyzer on ${localRepoPath}...`);

        const analyzerCommand = path.join(__dirname, 'node_modules', '.bin', 'repo-analyzer');
        const analyzerArgs = [`--path=${localRepoPath}`];

        if (history) {
            analyzerArgs.push('--history');
        }
        if (factor !== undefined && factor !== null) {
            analyzerArgs.push(`--factor=${factor}`);
        }

        if (elastic_username && elastic_password) {
            analyzerArgs.push(`--username=${elastic_username}`);
            analyzerArgs.push(`--password=${elastic_password}`);
            analyzerArgs.push('--elastic');
            console.log('[Node Service] Configuring repo-analyzer to send data directly to Elasticsearch.');
        } else {
            analyzerArgs.push('--reporter=json');
            console.log('[Node Service] Configuring repo-analyzer to output JSON.');
        }

        console.log(`[Node Service] Full command: ${analyzerCommand} ${analyzerArgs.join(' ')}`);
        console.log('PATH:', process.env.PATH);

        const analyzerProcess = spawn(analyzerCommand, analyzerArgs, { cwd: '/app', shell: true });


        analyzerProcess.stdout.on('data', (data) => {
            stdoutOutput += data.toString();
            console.log(`[Node Service] repo-analyzer stdout: ${data.toString().trim()}`);
        });

        analyzerProcess.stderr.on('data', (data) => {
            stderrOutput += data.toString();
            console.error(`[Node Service] repo-analyzer stderr: ${data.toString().trim()}`);
        });

        analyzerProcess.on('error', (err) => {
            console.error(`[Node Service] repo-analyzer process error event:`, err);
        });


        await new Promise((resolve, reject) => {
            analyzerProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('[Node Service] repo-analyzer completed successfully.');
                    resolve();
                } else {
                    console.error(`[Node Service] repo-analyzer exited with code ${code}. Final Stderr: ${stderrOutput}`);
                    reject(new Error(`repo-analyzer failed with code ${code}. Stderr: ${stderrOutput}`));
                }
            });
            analyzerProcess.on('error', (err) => {
                console.error(`[Node Service] Failed to start repo-analyzer process: ${err}`);
                reject(err);
            });
        }).catch(err => {
            console.error('[Node Service] Error during repo-analyzer execution:', err);
            throw err;
        });

        try {
            const analysisResult = (elastic_username && elastic_password) ? 
                { message: "Analysis completed. Data sent to Elasticsearch." } : JSON.parse(stdoutOutput);
            res.json({ success: true, analysis_output: analysisResult });
        } catch (parseError) {
            console.warn("[Node Service] Could not parse repo-analyzer output as JSON, sending raw text.", parseError);
            res.json({ success: true, analysis_output: stdoutOutput || "No structured output received." });
        }

    } catch (error) {
        console.error(`[Node Service] Analysis failed: ${error.message}`);
        res.status(500).json({
            error: `Analysis failed: ${error.message}`,
            details: error.message,
            stderr: stderrOutput
        });
    } finally {
        if (fs.existsSync(tempDir)) {
            console.log(`[Node Service] Cleaning up temporary directory: ${tempDir}`);
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
});

app.listen(port, () => {
    console.log(`[Node Service] Node.js analysis service listening at http://localhost:${port}`);
    console.log(`[Node Service] Ready to receive analysis requests from Flask.`);
});
