#define MyAppName "DOTA AI"
#define MyAppVersion "0.4.2"
#define MyAppPublisher "DOTA AI"

[Setup]
AppId={{B6F6E18A-6F7C-4D0D-8A3B-2D8D0A7A2E51}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\DOTA AI
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
OutputDir=..\release
OutputBaseFilename=DOTA-AI-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\DOTA AI.exe
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; GroupDescription: "Дополнительные задачи:"; Flags: unchecked

[Files]
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\DOTA AI"; Filename: "{app}\DOTA AI.exe"
Name: "{autodesktop}\DOTA AI"; Filename: "{app}\DOTA AI.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\DOTA AI.exe"; Description: "Запустить DOTA AI"; Flags: postinstall nowait skipifsilent
