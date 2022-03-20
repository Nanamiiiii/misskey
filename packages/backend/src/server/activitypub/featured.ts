import Router from '@koa/router';
import config from '@/config/index.js';
import { renderActivity } from '@/remote/activitypub/renderer/index.js';
import renderOrderedCollection from '@/remote/activitypub/renderer/ordered-collection.js';
import { setResponseType } from '../activitypub.js';
import renderNote from '@/remote/activitypub/renderer/note.js';
import { Users, Notes, UserNotePinings } from '@/models/index.js';
import { userCache } from './cache.js';

export default async (ctx: Router.RouterContext) => {
	const userId = ctx.params.user;

	// TODO: typeorm 3.0にしたら .then(x => x || null) は消せる
	const user = await userCache.fetch(userId, () => Users.findOne({
		id: userId,
		host: null,
	}).then(x => x || null));

	if (user == null) {
		ctx.status = 404;
		return;
	}

	const pinings = await UserNotePinings.find({
		where: { userId: user.id },
		order: { id: 'DESC' },
	});

	const pinnedNotes = await Promise.all(pinings.map(pining =>
		Notes.findOneOrFail(pining.noteId)));

	const renderedNotes = await Promise.all(pinnedNotes.map(note => renderNote(note)));

	const rendered = renderOrderedCollection(
		`${config.url}/users/${userId}/collections/featured`,
		renderedNotes.length, undefined, undefined, renderedNotes,
	);

	ctx.body = renderActivity(rendered);
	ctx.set('Cache-Control', 'public, max-age=180');
	setResponseType(ctx);
};
