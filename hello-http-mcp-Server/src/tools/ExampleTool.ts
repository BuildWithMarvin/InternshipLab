import { MCPTool } from "mcp-framework";


class HelloWorldTool extends MCPTool<{}> { 
name = "helloWorld";

description = "Gibt einfach den Text 'Hello World' zurück";

 schema = {};

async execute() {

 return "Hello World";
 }
}

export default HelloWorldTool;