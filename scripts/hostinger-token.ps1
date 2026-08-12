# Löser fram Hostinger-token utan att någonsin skriva ut den.
#
# Ordning: miljövariabeln HOSTINGER_API_TOKEN vinner alltid (så skriptet
# fungerar på vilken maskin eller i vilken CI som helst). Finns den inte
# faller det tillbaka på DPAPI-valvet på DEN HÄR Windows-maskinen, knutet till
# just detta användarkonto. Valvfilen innehåller ingen hemlighet i klartext,
# den går inte att läsa på någon annan dator eller av något annat konto.

if ($env:HOSTINGER_API_TOKEN) {
  Write-Output $env:HOSTINGER_API_TOKEN
  exit 0
}

$valv = "$env:USERPROFILE\HermesSecrets\hostinger-api-token.dpapi.txt"
if (-not (Test-Path $valv)) {
  Write-Error "Ingen HOSTINGER_API_TOKEN satt och inget DPAPI-valv hittat på $valv. Sätt miljövariabeln eller kör på Linns maskin."
  exit 1
}

try {
  $enc = Get-Content $valv -Raw
  $sec = ConvertTo-SecureString $enc
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $klartext = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Write-Output $klartext
} catch {
  Write-Error "Kunde inte låsa upp DPAPI-valvet: $($_.Exception.Message)"
  exit 1
}
