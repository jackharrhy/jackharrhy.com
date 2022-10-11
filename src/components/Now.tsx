import { useState, useEffect } from "react";

type Now = {
	id: string;
	time: Date;
	content: string;
	html: string;
};

const fetchNow = async () => {
	const resp = await fetch("https://jackharrhy.dev/server/now");
	const data = await resp.json();

	const options = {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	};
	const time = new Intl.DateTimeFormat(
		window.navigator.language,
		options as any
	)
		.format(new Date(data.time))
		.toLowerCase();

	return {
		...data,
		time,
	};
};

export default () => {
	const [now, setNow] = useState<Now>();
	useEffect(() => {
		fetchNow().then((data) => setNow(data));
	}, []);

	if (now === undefined) return <p className="opacity-50">...</p>;

	return (
		<>
			<p className="text-sm italic opacity-50">
				(last updated {now.time})
			</p>
			<div
				className="flex flex-col gap-4 p-4 now"
				dangerouslySetInnerHTML={{ __html: now.html }}
			/>
		</>
	);
};
