import type { Application } from '@nocobase/app-server/application';
import { ServiceProvider } from '@nocobase/service-provider';
import { agentsToken } from '@nocobase/app-plugin-agents/server/tokens';

/** A native-only scope for the documentation Skill. It grants no business permissions. */
export default class DocumentationAgentsProvider extends ServiceProvider<Application> {
  readonly name = 'app/documentation-agents';

  override async boot(): Promise<void> {
    const agents = this.app.container.resolve(agentsToken);
    agents.onlineAgent.configurator.registerOnlineAgentScope(
      'release-notes',
      async () => {
        // Select this one administrator-maintained Skill on the server, never the whole library or a browser-supplied ID.
        const skill = (await agents.skills.list()).find(
          (item) => item.slug === 'release-notes',
        );
        if (!skill)
          throw new Error(
            'Create the release-notes Skill before using this scope.',
          );
        return {
          agentId: 'online',
          tool: ['bash', 'skill'],
          skill: [skill.id],
          systemPromptTemplate:
            'Help write release notes from the supplied facts. Use the release-notes Skill and its supporting style guide when the user requests release notes. Never claim an unperformed check succeeded.',
        };
      },
    );
  }
}
