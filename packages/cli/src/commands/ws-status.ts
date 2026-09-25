import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export class WsStatusCommand extends BaseCommand {
  public readonly name = 'ws:status';
  public readonly description = 'Show WebSocket server connection metrics and room statistics';
  public readonly usage = 'jsango ws:status [options]';
  public readonly options = [];

  public async execute(context: CommandContext): Promise<number> {
    const wsServer = await context.getWebSocketServer();

    if (!wsServer) {
      if (context.output.isJson) {
        context.output.json({ active: false, stats: null });
      } else {
        context.output.info('No WebSocket server active or registered in application container.');
      }
      return ExitCode.SUCCESS;
    }

    const stats = wsServer.stats;

    if (context.output.isJson) {
      context.output.json({
        active: wsServer.isListening,
        stats,
      });
      return ExitCode.SUCCESS;
    }

    const { colors } = context.output;
    context.output.text(colors.bold('WebSocket Server Status\n'));

    context.output.table(
      ['Metric', 'Value'],
      [
        [
          'Server State',
          wsServer.isListening ? colors.green('Listening') : colors.yellow('Stopped'),
        ],
        ['Active Connections', colors.cyan(String(stats.activeConnections))],
        ['Active Rooms', colors.cyan(String(stats.activeRooms))],
        ['Messages Received', String(stats.totalMessagesReceived)],
        ['Messages Sent', String(stats.totalMessagesSent)],
        ['Total Errors', stats.totalErrors > 0 ? colors.red(String(stats.totalErrors)) : '0'],
      ]
    );

    return ExitCode.SUCCESS;
  }
}
