# rbxts-transformer-runtime-imports
This is a transformer that allows imports to only be called if the code is running on the server or the client.

## Installation
Simply install this transformer with your favorite package manager:
```sh
$ yarn add rbxts-transformer-runtime-imports
OR
$ npm install rbxts-transformer-runtime-imports
```
And then add it to your tsconfig like so:
```json
{
	"compilerOptions": {
		...
		"plugins": [
			{
				"transform": "rbxts-transformer-runtime-imports"
			}
		]
	}
}

```

## Example
**Input:**
```ts
// SharedDebuggingService.ts
//@runtime server
import { ServerDebuggingService } from "Server/ServerDebuggingService"
//@runtime client
import { ClientDebuggingService } from "Client/ClientDebuggingService"

return RunService.IsServer() ? ClientDebuggingService.OpenMenu() : ServerDebuggingService.OpenMenu()
```

**Output:**
```lua
-- SharedDebuggingService.lua
-- Compiled with roblox-ts v1.3.3
local TS = require(game:GetService("ReplicatedStorage"):WaitForChild("rbxts_include"):WaitForChild("RuntimeLib"))
-- SharedDebuggingService.ts
local RunService = TS.import(script, TS.getModule(script, "@rbxts", "services")).RunService
local __Server_ServerDebuggingService_import_data
local ServerDebuggingService
if game:GetService("RunService"):IsServer() then
	TS.async(function()
		__Server_ServerDebuggingService_import_data = TS.await(TS.Promise.new(function(resolve)
			resolve(TS.import(script, game:GetService("ServerScriptService"), "Apollo", "ServerDebuggingService"))
		end))
	end)()
	while __Server_ServerDebuggingService_import_data == nil do
		task.wait()
	end
	ServerDebuggingService = __Server_ServerDebuggingService_import_data.ServerDebuggingService
end
local __Client_ClientDebuggingService_import_data
local ClientDebuggingService
if game:GetService("RunService"):IsClient() then
	TS.async(function()
		__Client_ClientDebuggingService_import_data = TS.await(TS.Promise.new(function(resolve)
			resolve(TS.import(script, game:GetService("ReplicatedStorage"), "Apollo", "ClientDebuggingService"))
		end))
	end)()
	while __Client_ClientDebuggingService_import_data == nil do
		task.wait()
	end
	ClientDebuggingService = __Client_ClientDebuggingService_import_data.ClientDebuggingService
end
local SharedDebuggingService = if RunService:IsServer() then ClientDebuggingService.OpenMenu() else ServerDebuggingService.OpenMenu()
return {
	SharedDebuggingService = SharedDebuggingService,
}
```

This module doesn't currently support star imports such as the following, but feel free to open a pull request on the GitHub repo, it shouldn't be a very hard feature to add.
```ts
//@runtime server
import * as ServerModule from "Server/MyServerModule"
```