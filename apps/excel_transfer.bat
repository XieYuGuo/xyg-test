@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"

set origin=A
set originSheet=服务单
set target=B
set targetFirstSheet=今日
set targetSecondSheet=历史

set originFile=%CD%\%origin%.xlsx
set targetFile=%CD%\%target%.xlsx

if not exist "%originFile%" (
    echo [Error] Source file not found: %originFile%
    pause
    exit /b 1
)

if not exist "%targetFile%" (
    echo [Error] Target file not found: %targetFile%
    pause
    exit /b 1
)

set "ERROR_CODE=0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $host.UI.RawUI.WindowTitle = 'Excel Data Transfer Tool'; Write-Host ''; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'Excel Data Transfer Tool' -ForegroundColor Cyan; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; Write-Host '当前配置信息:'; Write-Host '源文件: %origin%.xlsx'; Write-Host '源文件工作表: %originSheet%'; Write-Host '目标文件: %target%.xlsx'; Write-Host '目标文件工作表1: %targetFirstSheet%'; Write-Host '目标文件工作表2: %targetSecondSheet%'; Write-Host '========================================'; Write-Host ''; Write-Host '[信息] 源文件和目标文件已找到' -ForegroundColor Green; Write-Host '[信息] 准备处理Excel数据...' -ForegroundColor Green; Write-Host ''; $originFile = '%originFile%'; $targetFile = '%targetFile%'; $originSheet = '%originSheet%'; $targetFirstSheet = '%targetFirstSheet%'; $targetSecondSheet = '%targetSecondSheet%'; try { Write-Host '[信息] 正在打开源文件...' -ForegroundColor Green; $excel = New-Object -ComObject Excel.Application; $excel.Visible = $false; $excel.DisplayAlerts = $false; $originWorkbook = $excel.Workbooks.Open($originFile); $originWorksheet = $originWorkbook.Worksheets.Item($originSheet); Write-Host '[信息] 正在打开目标文件...' -ForegroundColor Green; $targetWorkbook = $excel.Workbooks.Open($targetFile); $targetFirstWorksheet = $targetWorkbook.Worksheets.Item($targetFirstSheet); $targetSecondWorksheet = $targetWorkbook.Worksheets.Item($targetSecondSheet); Write-Host '[信息] 正在查找非空列...' -ForegroundColor Green; $usedRange = $originWorksheet.UsedRange; $rowCount = $usedRange.Rows.Count; $colCount = $usedRange.Columns.Count; $nonEmptyCols = @(); for($col = 1; $col -le $colCount; $col++) { $colHasData = $false; for($row = 1; $row -le $rowCount; $row++) { $cellValue = $originWorksheet.Cells.Item($row, $col).Value2; if($cellValue -ne $null -and $cellValue -ne '') { $colHasData = $true; break } } if($colHasData) { $nonEmptyCols += $col } }; if($nonEmptyCols.Count -eq 0) { Write-Host '[警告] 源工作表中未找到数据' -ForegroundColor Yellow; $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null; exit 0 }; Write-Host ('[信息] 找到 ' + $nonEmptyCols.Count + ' 个非空列，正在复制数据...') -ForegroundColor Green; foreach($col in $nonEmptyCols) { for($row = 1; $row -le $rowCount; $row++) { $cellValue = $originWorksheet.Cells.Item($row, $col).Value2; $targetFirstWorksheet.Cells.Item($row, $col).Value2 = $cellValue; $targetSecondWorksheet.Cells.Item($row, $col).Value2 = $cellValue } }; Write-Host '[信息] 正在保存目标文件...' -ForegroundColor Green; $targetWorkbook.Save(); Write-Host '[信息] 正在关闭Excel...' -ForegroundColor Green; $targetWorkbook.Close($false); $originWorkbook.Close($false); $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null; Write-Host ''; Write-Host '[成功] 数据复制完成！' -ForegroundColor Green; exit 0 } catch { Write-Host ''; Write-Host '[错误] 发生异常:' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red; Write-Host $_.Exception.StackTrace -ForegroundColor Red; try { if($excel) { $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } } catch {}; exit 1 }"

set "ERROR_CODE=%ERRORLEVEL%"

if %ERROR_CODE% equ 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host ''; Write-Host '操作完成！' -ForegroundColor Green"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host ''; Write-Host ('[错误] 脚本执行失败，错误代码: %ERROR_CODE%') -ForegroundColor Red"
)

pause
exit /b %ERROR_CODE%
