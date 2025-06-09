const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { format, addDays, parseISO } = require('date-fns');

async function fetchBlameAllBranches(owner, repo, local, startDate, endDate) {
  if (local) 
    const repoPath = `/app/clones/${repo}`;
    const resultsByDate = {};

    const seenDates = new Set();
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    for (let d = start; d <= end; d = addDays(d, 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        seenDates.add(dateStr);
    }

    try {
        const { stdout: branchesStdout } = await execPromise(`git -C ${repoPath} branch -a --format="%(refname:short)"`);
        const branches = branchesStdout.split('\n').map(b => b.trim()).filter(Boolean);

        for (const dateStr of seenDates) {
        const blamePerAuthor = {};

        // Checkout the latest commit before the given date across all branches
        let commitSha = null;
        for (const branch of branches) {
            try {
            const { stdout } = await execPromise(`git -C ${repoPath} rev-list -1 --before="${dateStr} 23:59:59" ${branch}`);
            if (stdout.trim()) {
                commitSha = stdout.trim();
                break; // Stop at first found branch for simplification
            }
            } catch (e) {
            continue;
            }
        }

        if (!commitSha) continue;

        await execPromise(`git -C ${repoPath} checkout ${commitSha}`);

        const { stdout: fileList } = await execPromise(`git -C ${repoPath} ls-files`);
        const files = fileList.split('\n').filter(f => f.trim().length > 0);

        for (const file of files) {
            try {
            const { stdout: blameOutput } = await execPromise(`git -C ${repoPath} blame --line-porcelain ${file}`);
            const lines = blameOutput.split('\n');
            for (const line of lines) {
                if (line.startsWith('author ')) {
                const author = line.slice(7).trim();
                blamePerAuthor[author] = (blamePerAuthor[author] || 0) + 1;
                }
            }
            } catch (e) {
            // Ignore errors on unreadable files
            }
        }

        resultsByDate[dateStr] = blamePerAuthor;
        }

        return resultsByDate;
    } catch (err) {
        console.error('Error in fetchBlameAllBranches:', err);
        return {};
    }
}

module.exports = { fetchBlameAllBranches };
