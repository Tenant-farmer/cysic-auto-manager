# PreToolUse hook: Block any Read/Edit/Write/Bash operation that touches
# secret files (mnemonics, private keys, keystores).
#
# Hook receives JSON via stdin:  { "tool_name": "...", "tool_input": { ... } }
# Exit 2 = block + show stderr to Claude. Exit 0 = allow.

$ErrorActionPreference = 'Stop'

# Patterns considered secret. Case-insensitive. Adjust as needed.
$secretPatterns = @(
    '\.env(\.|$)',        # .env, .env.local, .env.production, etc.
    '[/\\]secrets[/\\]',  # /secrets/ or \secrets\
    '[/\\]keystore[/\\]',
    '[/\\]private-keys[/\\]',
    'wallets?\.json$',
    '\.key$',
    '\.pem$',
    'mnemonic',
    'seedphrase'
)

function Test-IsSecret {
    param([string]$text)
    if ([string]::IsNullOrEmpty($text)) { return $false }
    foreach ($p in $secretPatterns) {
        if ($text -match $p) { return $true }
    }
    return $false
}

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $req = $raw | ConvertFrom-Json
} catch {
    # Can't parse — allow rather than block legitimate work
    exit 0
}

$toolName = $req.tool_name
$ti = $req.tool_input

switch -Regex ($toolName) {
    '^(Read|Edit|Write|NotebookEdit)$' {
        $path = $ti.file_path
        if (Test-IsSecret $path) {
            [Console]::Error.WriteLine("BLOCKED by .claude/hooks/block-secrets.ps1")
            [Console]::Error.WriteLine("Reason: $toolName on secret-looking path: $path")
            [Console]::Error.WriteLine("Use masked inspection (awk) or ask the user to edit it directly with notepad.")
            exit 2
        }
    }
    '^Bash$' {
        $cmd = $ti.command
        # Block commands that would dump a secret file's contents.
        if ($cmd -match '\b(cat|type|Get-Content|head|tail|less|more|gc)\b.*(\.env|secrets|keystore|\.key|\.pem|wallets?\.json|mnemonic)') {
            [Console]::Error.WriteLine("BLOCKED by .claude/hooks/block-secrets.ps1")
            [Console]::Error.WriteLine("Reason: Bash command appears to dump a secret file:")
            [Console]::Error.WriteLine($cmd)
            [Console]::Error.WriteLine("Use awk masking pattern instead.")
            exit 2
        }
    }
    default {
        # Other tools — let through
    }
}

exit 0
