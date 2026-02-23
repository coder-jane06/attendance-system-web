$shell = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Attendance System.lnk"
$targetPath = "C:\Projects\attendance-system\START_SERVER.bat"
$workingDirectory = "C:\Projects\attendance-system"

$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $workingDirectory
$shortcut.WindowStyle = 1
$shortcut.Description = "Start the Attendance Management System"
$shortcut.IconLocation = "C:\Windows\System32\cmd.exe,0"
$shortcut.Save()

Write-Host "Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "Look for 'Attendance System' on your desktop" -ForegroundColor Green
Write-Host "Double-click to start the server and website" -ForegroundColor Green
